import * as hubspot from '@hubspot/api-client';
import { DateTime, Duration, Interval } from 'luxon';
import fetch from 'node-fetch';
import { contactFromHubspot } from '../engine/contacts.js';
import config, { Pipeline } from '../util/config.js';
import * as datadir from '../util/datadir.js';
import { AttachableError, SimpleError } from '../util/errors.js';
import * as logger from '../util/logger.js';


/** @implements {Downloader} */
export default class LiveDownloader {

  constructor() {
    this.hubspotClient = new hubspot.Client({ apiKey: config.hubspot.apiKey });
  }

  /**
   * @returns {Promise<string[]>}
   */
  async downloadFreeEmailProviders() {
    const res = await fetch(`https://f.hubspotusercontent40.net/hubfs/2832391/Marketing/Lead-Capture/free-domains-1.csv`);
    const text = await res.text();
    const domains = text.split(',\n');
    save('domains.json', domains);
    return domains;
  }

  /**
   * @returns {Promise<Transaction[]>}
   */
  async downloadTransactions() {
    logger.info('Live Downloader', 'Starting to download Transactions');
    /** @type {Transaction[]} */
    const json = await downloadMarketplaceData('/sales/transactions/export');
    logger.info('Live Downloader', 'Downloaded Transactions');

    save('transactions.json', json);
    return json;
  }

  /**
   * @returns {Promise<License[]>}
   */
  async downloadLicensesWithoutDataInsights() {
    logger.info('Live Downloader', 'Starting to download Licenses Without Data Insights');
    /** @type {License[]} */
    let json = await downloadMarketplaceData('/licenses/export?endDate=2018-7-1');
    logger.info('Live Downloader', 'Downloaded Licenses without-data-insights up to 2018-07-01');

    json.forEach(fixOdditiesInLicenses);
    save('licenses-without.json', json);
    return json;
  }

  /**
   * @returns {Promise<License[]>}
   */
  async downloadLicensesWithDataInsights() {
    logger.info('Live Downloader', 'Starting to download Licenses With Data Insights');
    const promises = generateDates().map(async ({ startDate, endDate }) => {
      /** @type {License[]} */
      const json = await downloadMarketplaceData(`/licenses/export?withDataInsights=true&startDate=${startDate}&endDate=${endDate}`);
      logger.info('Live Downloader', 'Downloaded Licenses with-data-insights for range:', startDate, endDate);
      return { date: `${startDate}-${endDate}`, json };
    });

    let licenses = await Promise.all(promises).then(results => {
      /** @type {License[]} */
      let array = [];
      for (const result of results) {
        array = array.concat(result.json);
      }
      return array;
    });

    licenses.forEach(fixOdditiesInLicenses);
    save('licenses-with.json', licenses);
    return licenses;
  }

  /**
   * @returns {Promise<Company[]>}
   */
  async downloadAllCompanies() {
    const properties = [
      'name',
      'type',
    ];

    let companies;
    try { companies = await this.hubspotClient.crm.companies.getAll(undefined, undefined, properties); }
    catch (e) {
      throw new Error('Failed downloading companies: ' + e.response.body.message);
    }

    const adjustedCompanies = companies.map(result => ({
      id: result.id,
      name: result.properties.name,
      type: /** @type {any} */ (result.properties.type),
    }));

    logger.info('Live Downloader', 'Downloaded Companies');

    save('companies.json', adjustedCompanies);
    return adjustedCompanies;
  }

  /**
   * @returns {Promise<Deal[]>}
   */
  async downloadAllDeals() {
    const properties = [
      'closedate',
      'deployment',
      'addonlicenseid',
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
    catch (e) {
      throw new Error('Failed downloading deals: ' + e.response.body.message);
    }

    logger.info('Live Downloader', 'Downloaded Deals');

    save('deals-raw.json', deals);

    const adjustedDeals = (deals
      .filter(d => d.properties.pipeline === Pipeline.AtlassianMarketplace)
      .map(deal => {
        delete deal.properties.hs_object_id;
        delete deal.properties.hs_lastmodifieddate;
        delete deal.properties.createdate;
        deal.properties.closedate = deal.properties.closedate.substr(0, 10);

        return ({
          id: deal.id,
          properties: /** @type {Deal['properties']} */(deal.properties),
          contactIds: (deal.associations?.contacts.results
            .filter(result => result.type === 'deal_to_contact')
            .map(result => result.id)) || [],
        });
      })
    );

    save('deals.json', adjustedDeals);
    return adjustedDeals;
  }

  /**
   * @returns {Promise<Contact[]>}
   */
  async downloadAllContacts() {
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
    catch (e) {
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

    logger.info('Live Downloader', 'Downloaded Contacts');

    const adjustedContacts = contacts.map(contactFromHubspot);

    save('contacts.json', adjustedContacts);
    return adjustedContacts;
  }

}


/**
 * @template T
 * @param {string} subpath
 * @return {Promise<T[]>}
 */
async function downloadMarketplaceData(subpath) {
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
    throw new AttachableError('Probably invalid Marketplace JSON.', /** @type {string} */(text));
  }
}

/**
 * @param {License} license
 */
function fixOdditiesInLicenses(license) {
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

/**
 * @template {{[key:string]:string}} T
 * @template {keyof T} K
 * @param {T | undefined} o
 * @param {K} key
 */
const normalizeLicenseNewlines = (o, key) => {
  if (o && typeof (o[key]) === 'string') {
    o[key] = /** @type {T[K]} */(o[key].replace(/\r/g, ''));
  }
}

/**
 * @template {{[key:string]:string}} T
 * @template {keyof T} K
 * @param {T | undefined} o
 * @param {K} key
 */
const normalizeLicenseNullLiteral = (o, key) => {
  if (o && (o[key]) === 'null') {
    delete o[key];
  }
}



// Helpers

/**
 * @param {string} file
 * @param {unknown} data
 */
function save(file, data) {
  if (config.isProduction) return;

  const content = JSON.stringify(data, null, 2);
  datadir.writeFile('in', file, content);

  logger.info('Live Downloader', 'Saved', file);
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
