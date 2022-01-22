import got from 'got';
import promiseAllProperties from 'promise-all-properties';
import { Data, DataSet } from '../data/set';
import HubspotAPI from "../hubspot/api";
import { CompanyAdapter } from '../hubspot/model/company';
import { ContactAdapter } from '../hubspot/model/contact';
import { DealAdapter } from '../hubspot/model/deal';
import { MultiDownloadLogger } from "../log/download-logger";
import log from "../log/logger";
import { MarketplaceAPI } from "../marketplace/api";
import { HubspotCreds, MpacCreds } from "../parameters/interfaces";

type DownloadConfig = {
  hubspotCreds: HubspotCreds;
  mpacCreds: MpacCreds;
};

export async function downloadAllData(dataSet: DataSet, config: DownloadConfig): Promise<Data> {
  const hubspotAPI = new HubspotAPI(config.hubspotCreds);
  const marketplaceAPI = new MarketplaceAPI(config.mpacCreds);

  log.info('Downloader', 'Starting downloads with API');
  const logbox = new MultiDownloadLogger();

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
      hubspotAPI.downloadHubspotEntities(DealAdapter)),

    rawCompanies: logbox.wrap('Companies', () =>
      hubspotAPI.downloadHubspotEntities(CompanyAdapter)),

    rawContacts: logbox.wrap('Contacts', () =>
      hubspotAPI.downloadHubspotEntities(ContactAdapter)),
  });

  dataSet.save(data);

  logbox.done();
  log.info('Downloader', 'Done');

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
