import got from 'got';
import promiseAllProperties from 'promise-all-properties';
import { dataManager } from '../data/manager';
import HubspotAPI from "../hubspot/api";
import { Console } from '../log/console';
import { MultiDownloadLogger } from "../log/download";
import { MarketplaceAPI } from "../marketplace/api";
import { CompanyManager } from '../model/company';
import { ContactManager } from '../model/contact';
import { DealManager } from '../model/deal';

interface HubspotManagers {
  dealManager: DealManager,
  contactManager: ContactManager,
  companyManager: CompanyManager,
}

export async function downloadAllData(console: Console, managers: HubspotManagers) {
  const hubspotAPI = new HubspotAPI(console);
  const marketplaceAPI = new MarketplaceAPI();

  console.printInfo('Downloader', 'Starting downloads with API');
  const logbox = new MultiDownloadLogger(console);

  const data = await promiseAllProperties({
    tlds: logbox.wrap('Tlds', () =>
      downloadAllTlds()),

    licensesWithDataInsights: logbox.wrap('Licenses With Data Insights', (progress) =>
      marketplaceAPI.downloadLicensesWithDataInsights(progress)),

    licensesWithoutDataInsights: logbox.wrap('Licenses Without Data Insights', () =>
      marketplaceAPI.downloadLicensesWithoutDataInsights()),

    transactions: logbox.wrap('Transactions', () =>
      marketplaceAPI.downloadTransactions()),

    freeDomains: logbox.wrap('Free Email Providers', () =>
      downloadFreeEmailProviders()),

    rawDeals: logbox.wrap('Deals', () =>
      hubspotAPI.downloadHubspotEntities(managers.dealManager.entityAdapter)),

    rawCompanies: logbox.wrap('Companies', () =>
      hubspotAPI.downloadHubspotEntities(managers.companyManager.entityAdapter)),

    rawContacts: logbox.wrap('Contacts', () =>
      hubspotAPI.downloadHubspotEntities(managers.contactManager.entityAdapter)),
  });

  const dataSet = dataManager.newDataSet();
  dataSet.save(data);

  logbox.done();
  console.printInfo('Downloader', 'Done');

  return { dataSet, data };
}

async function downloadAllTlds(): Promise<string[]> {
  const res = await got.get(`https://data.iana.org/TLD/tlds-alpha-by-domain.txt`);
  const tlds = res.body.trim().split('\n').splice(1).map(s => s.toLowerCase());
  return tlds;
}

async function downloadFreeEmailProviders(): Promise<string[]> {
  const res = await got.get(`https://f.hubspotusercontent40.net/hubfs/2832391/Marketing/Lead-Capture/free-domains-1.csv`);
  const domains = res.body.split(',\n');
  return domains;
}
