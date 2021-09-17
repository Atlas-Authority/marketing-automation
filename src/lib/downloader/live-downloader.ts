import * as hubspot from '@hubspot/api-client';
import { DateTime, Duration, Interval } from 'luxon';
import fetch from 'node-fetch';
import { contactFromHubspot } from '../engine/contacts.js';
import { Company } from '../types/company.js';
import { Contact } from '../types/contact.js';
import { Deal } from '../types/deal.js';
import { License } from '../types/license.js';
import { Transaction } from '../types/transaction.js';
import config, { Pipeline } from '../util/config/index.js';
import * as datadir from '../util/datadir.js';
import { AttachableError, SimpleError } from '../util/errors.js';
import log from '../util/logger.js';
import { Downloader } from './downloader.js';


export default class LiveDownloader implements Downloader {

  hubspotClient = new hubspot.Client({ apiKey: config.hubspot.apiKey });

  async downloadFreeEmailProviders(): Promise<string[]> {
    const res = await fetch(`https://f.hubspotusercontent40.net/hubfs/2832391/Marketing/Lead-Capture/free-domains-1.csv`);
    const text = await res.text();
    const domains = text.split(',\n');
    save('domains.json', domains);
    return domains;
  }

  async downloadAllTlds(): Promise<string[]> {
    const res = await fetch(`https://data.iana.org/TLD/tlds-alpha-by-domain.txt`);
    const text = await res.text();
    const tlds = text.trim().split('\n').splice(1).map(s => s.toLowerCase());
    save('tlds.json', tlds);
    return tlds;
  }

  async downloadTransactions(): Promise<Transaction[]> {
    log.info('Live Downloader', 'Starting to download Transactions');
    const json: Transaction[] = await downloadMarketplaceData('/sales/transactions/export');
    log.info('Live Downloader', 'Downloaded Transactions');

    save('transactions.json', json);
    return json;
  }

  async downloadLicensesWithoutDataInsights(): Promise<License[]> {
    log.info('Live Downloader', 'Starting to download Licenses Without Data Insights');
    let json: License[] = await downloadMarketplaceData('/licenses/export?endDate=2018-07-01');
    log.info('Live Downloader', 'Downloaded Licenses without-data-insights up to 2018-07-01');

    json.forEach(fixOdditiesInLicenses);
    save('licenses-without.json', json);
    return json;
  }

  async downloadLicensesWithDataInsights(): Promise<License[]> {
    log.info('Live Downloader', 'Starting to download Licenses With Data Insights');
    const promises = generateDates().map(async ({ startDate, endDate }) => {
      const json: License[] = await downloadMarketplaceData(`/licenses/export?withDataInsights=true&startDate=${startDate}&endDate=${endDate}`);
      log.info('Live Downloader', 'Downloaded Licenses with-data-insights for range:', startDate, endDate);
      return { date: `${startDate}-${endDate}`, json };
    });

    let licenses = await Promise.all(promises).then(results => {
      let array: License[] = [];
      for (const result of results) {
        array = array.concat(result.json);
      }
      return array;
    });

    licenses.forEach(fixOdditiesInLicenses);
    save('licenses-with.json', licenses);
    return licenses;
  }

  async downloadAllCompanies(): Promise<Company[]> {
    const properties = [
      'name',
      'type',
    ];

    let companies;
    try { companies = await this.hubspotClient.crm.companies.getAll(undefined, undefined, properties); }
    catch (e: any) {
      throw new Error('Failed downloading companies: ' + e.response.body.message);
    }

    const adjustedCompanies = companies.map(result => ({
      id: result.id,
      name: result.properties.name,
      type: result.properties.type as any,
    }));

    log.info('Live Downloader', 'Downloaded Companies');

    save('companies.json', adjustedCompanies);
    return adjustedCompanies;
  }

  async downloadAllDeals(): Promise<Deal[]> {
    const properties = [
      'closedate',
      'deployment',
      config.hubspot.attrs.deal.addonLicenseId,
      config.hubspot.attrs.deal.transactionId,
      'aa_app',
      'license_tier',
      'country',
      'origin',
      'related_products',
      'dealname',
      'dealstage',
      'pipeline',
      'amount',
    ];

    let deals;
    try { deals = await this.hubspotClient.crm.deals.getAll(undefined, undefined, properties, ['contact']); }
    catch (e: any) {
      throw new Error('Failed downloading deals: ' + e.response.body.message);
    }

    log.info('Live Downloader', 'Downloaded Deals');

    save('deals-raw.json', deals);

    const adjustedDeals = (deals
      .filter(d => d.properties.pipeline === Pipeline.AtlassianMarketplace)
      .map(deal => {
        delete deal.properties.hs_object_id;
        delete deal.properties.hs_lastmodifieddate;
        delete deal.properties.createdate;
        deal.properties.closedate = deal.properties.closedate.substr(0, 10);

        const addonlicenseid = deal.properties[config.hubspot.attrs.deal.addonLicenseId] || '';
        const transactionid = deal.properties[config.hubspot.attrs.deal.transactionId] || '';

        delete deal.properties[config.hubspot.attrs.deal.addonLicenseId];
        delete deal.properties[config.hubspot.attrs.deal.transactionId];

        return ({
          id: deal.id,
          properties: ({
            ...deal.properties,
            addonlicenseid,
            transactionid,
          } as Deal['properties']),
          contactIds: (deal.associations?.contacts.results
            .filter(result => result.type === 'deal_to_contact')
            .map(result => result.id)) || [],
        });
      })
    );

    save('deals.json', adjustedDeals);
    return adjustedDeals;
  }

  async downloadAllContacts(): Promise<Contact[]> {
    const properties = [
      'email',
      'city',
      'state',
      'country',
      'region',
      'contact_type',
      'hosting',
      'firstname',
      'lastname',
      'phone',
      'deployment',
      'related_products',
      'license_tier',
      'last_mpac_event',
      'hs_additional_emails',
    ];

    let contacts;
    try { contacts = await this.hubspotClient.crm.contacts.getAll(undefined, undefined, properties, ['company']); }
    catch (e: any) {
      const body = e.response.body;
      if (
        (
          typeof body === 'string' && (
            body === 'internal error' ||
            body.startsWith('<!DOCTYPE html>'))
        ) || (
          typeof body === 'object' &&
          body.status === 'error' &&
          body.message === 'internal error'
        )
      ) {
        throw new SimpleError('Hubspot Contacts v3 API had internal error.');
      }
      else {
        throw new Error('Failed downloading contacts: ' + JSON.stringify(body));
      }
    }

    log.info('Live Downloader', 'Downloaded Contacts');

    const adjustedContacts = contacts.map(contactFromHubspot);

    save('contacts.json', adjustedContacts);
    return adjustedContacts;
  }

}


async function downloadMarketplaceData<T>(subpath: string): Promise<T[]> {
  const res = await fetch(`https://marketplace.atlassian.com/rest/2/vendors/${config.mpac.sellerId}/reporting${subpath}`, {
    headers: {
      'Authorization': 'Basic ' + Buffer.from(config.mpac.user + ':' + config.mpac.pass).toString('base64'),
    },
  });

  let text;
  let json;

  try {
    text = await res.text();
    json = JSON.parse(text);
    return json;
  }
  catch (e) {
    throw new AttachableError('Probably invalid Marketplace JSON.', text as string);
  }
}

function fixOdditiesInLicenses(license: License) {
  normalizeLicenseNewlines(license.contactDetails.technicalContact, 'address1');
  normalizeLicenseNewlines(license.contactDetails.technicalContact, 'address2');
  normalizeLicenseNewlines(license.contactDetails.billingContact, 'address1');
  normalizeLicenseNewlines(license.contactDetails.billingContact, 'address2');

  normalizeLicenseNullLiteral(license.contactDetails.technicalContact, 'phone');
  normalizeLicenseNullLiteral(license.contactDetails.technicalContact, 'address1');
  normalizeLicenseNullLiteral(license.contactDetails.technicalContact, 'city');
  normalizeLicenseNullLiteral(license.contactDetails.technicalContact, 'state');

  normalizeLicenseNullLiteral(license.contactDetails.billingContact, 'phone');
  normalizeLicenseNullLiteral(license.contactDetails.billingContact, 'address1');
  normalizeLicenseNullLiteral(license.contactDetails.billingContact, 'city');
  normalizeLicenseNullLiteral(license.contactDetails.billingContact, 'state');
}

function normalizeLicenseNewlines<T extends { [key: string]: string }, K extends keyof T>(o: T | undefined, key: K) {
  if (o && typeof (o[key]) === 'string') {
    o[key] = o[key].replace(/\r/g, '') as T[K];
  }
}

function normalizeLicenseNullLiteral<T extends { [key: string]: string }, K extends keyof T>(o: T | undefined, key: K) {
  if (o && (o[key]) === 'null') {
    delete o[key];
  }
}



// Helpers

function save(file: string, data: unknown) {
  if (config.isProduction) return;

  const content = JSON.stringify(data, null, 2);
  datadir.writeFile('in', file, content);

  log.info('Live Downloader', 'Saved', file);
}

function generateDates() {
  return Interval.fromDateTimes(
    DateTime.local(2018, 7, 1),
    DateTime.local()
  ).splitBy(Duration.fromObject({ months: 2 })).map(int => ({
    startDate: int.start.toISODate(),
    endDate: int.end.toISODate(),
  }));
}
