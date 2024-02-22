import got from 'got';
import promiseAllProperties from 'promise-all-properties';
import { dataManager } from '../data/manager';
import HubspotAPI from '../hubspot/api';
import { Hubspot, HubspotConfig } from '../hubspot/hubspot';
import { ConsoleLogger } from '../log/console';
import { MultiDownloadLogger } from '../log/download';
import { MarketplaceAPI } from '../marketplace/api/api';

export async function downloadAllData(console: ConsoleLogger, hubspotConfig: HubspotConfig) {
  const hubspotAPI = new HubspotAPI(console);
  const marketplaceAPI = new MarketplaceAPI();

  const hubspot = new Hubspot(hubspotConfig);

  console.printInfo('Downloader', 'Starting downloads with API');
  const logbox = new MultiDownloadLogger(console);

  const data = await promiseAllProperties({
    tlds: logbox.wrap('Tlds', () => downloadAllTlds()),

    licensesWithDataInsights: logbox.wrap('Licenses With Data Insights', (progress) =>
      marketplaceAPI.downloadLicensesWithDataInsights(progress)
    ),

    licensesWithoutDataInsights: logbox.wrap('Licenses Without Data Insights', () =>
      marketplaceAPI.downloadLicensesWithoutDataInsights()
    ),

    transactions: logbox.wrap('Transactions', () => marketplaceAPI.downloadTransactions()),

    freeDomains: logbox.wrap('Free Email Providers', () => downloadFreeEmailProviders()),

    rawDeals: logbox.wrap('Deals', () => hubspotAPI.downloadHubspotEntities(hubspot.dealManager.entityAdapter)),

    rawCompanies: logbox.wrap('Companies', () =>
      hubspotAPI.downloadHubspotEntities(hubspot.companyManager.entityAdapter)
    ),

    rawContacts: logbox.wrap('Contacts', () =>
      hubspotAPI.downloadHubspotEntities(hubspot.contactManager.entityAdapter)
    ),
  });

  const ms = dataManager.createDataSet(data);

  logbox.done();
  console.printInfo('Downloader', 'Done');

  return ms;
}

async function downloadAllTlds(): Promise<string[]> {
  const res = await got.get(`https://data.iana.org/TLD/tlds-alpha-by-domain.txt`);
  const tlds = res.body
    .trim()
    .split('\n')
    .splice(1)
    .map((s) => s.toLowerCase());
  return tlds;
}

async function downloadFreeEmailProviders(): Promise<string[]> {
  const res = await got.get(
    `https://f.hubspotusercontent40.net/hubfs/2832391/Marketing/Lead-Capture/free-domains-1.csv`
  );
  const domains = res.body.split(',\n');
  return domains;
}
