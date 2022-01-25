import got from 'got';
import promiseAllProperties from 'promise-all-properties';
import { Data, DataSet } from '../data/set';
import HubspotAPI from "../hubspot/api";
import { CompanyManager } from '../hubspot/model/company';
import { ContactManager } from '../hubspot/model/contact';
import { DealManager } from '../hubspot/model/deal';
import { Logger } from "../log";
import { MultiDownloadLogger } from "../log/download";
import { MarketplaceAPI } from "../marketplace/api";

interface HubspotManagers {
  dealManager: DealManager,
  contactManager: ContactManager,
  companyManager: CompanyManager,
}

export async function downloadAllData(log: Logger, dataSet: DataSet, managers: HubspotManagers): Promise<Data> {
  const hubspotAPI = new HubspotAPI(log);
  const marketplaceAPI = new MarketplaceAPI();

  log.printInfo('Downloader', 'Starting downloads with API');
  const logbox = new MultiDownloadLogger(log);

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

  dataSet.save(data);

  logbox.done();
  log.printInfo('Downloader', 'Done');

  return data;
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
