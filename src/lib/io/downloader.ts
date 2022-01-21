import promiseAllProperties from 'promise-all-properties';
import DataDir from "../data/dir";
import { MultiDownloadLogger } from "../log/download-logger";
import log from "../log/logger";
import { CompanyAdapter } from '../model/company';
import { ContactAdapter } from '../model/contact';
import { DealAdapter } from '../model/deal';
import { FullEntity } from "../model/hubspot/interfaces";
import { downloadHubspotEntities } from '../model/hubspot/manager';
import { RawLicense, RawTransaction } from "../model/marketplace/raw";
import { HubspotCreds, MpacCreds } from "../parameters/interfaces";
import { Data } from "./interfaces";
import { TldListAPI } from "./live/domains";
import { EmailProviderAPI } from "./live/email-providers";
import HubspotAPI from "./live/hubspot";
import { MarketplaceAPI } from "./live/marketplace";

export function loadDataFromDisk(dataDir: DataDir): Data {
  return {
    licensesWithDataInsights: dataDir.file<readonly RawLicense[]>('licenses-with.csv').readArray(),
    licensesWithoutDataInsights: dataDir.file<readonly RawLicense[]>('licenses-without.csv').readArray(),
    transactions: dataDir.file<readonly RawTransaction[]>('transactions.csv').readArray(),
    tlds: dataDir.file<readonly { tld: string }[]>('tlds.csv').readArray().map(({ tld }) => tld),
    freeDomains: dataDir.file<readonly { domain: string }[]>('domains.csv').readArray().map(({ domain }) => domain),
    rawDeals: dataDir.file<FullEntity[]>(`deal.csv`).readArray(),
    rawCompanies: dataDir.file<FullEntity[]>(`company.csv`).readArray(),
    rawContacts: dataDir.file<FullEntity[]>(`contact.csv`).readArray(),
  }
}

type DownloadConfig = {
  hubspotCreds: HubspotCreds;
  mpacCreds: MpacCreds;
};

export class Downloader {

  constructor(
    private dataDir: DataDir,
    private config: DownloadConfig,
  ) { }

  async downloadData(): Promise<Data> {
    const hubspot = new HubspotAPI(this.dataDir, this.config.hubspotCreds);
    const marketplace = new MarketplaceAPI(this.dataDir, this.config.mpacCreds);
    const emailProviderLister = new EmailProviderAPI(this.dataDir);
    const tldLister = new TldListAPI(this.dataDir);

    log.info('Downloader', 'Starting downloads with API');
    const logbox = new MultiDownloadLogger();

    const data = await promiseAllProperties({
      tlds: logbox.wrap('Tlds', (progress) =>
        tldLister.downloadAllTlds()),

      licensesWithDataInsights: logbox.wrap('Licenses With Data Insights', (progress) =>
        marketplace.downloadLicensesWithDataInsights(progress)),

      licensesWithoutDataInsights: logbox.wrap('Licenses Without Data Insights', (progress) =>
        marketplace.downloadLicensesWithoutDataInsights()),

      transactions: logbox.wrap('Transactions', (progress) =>
        marketplace.downloadTransactions()),

      freeDomains: logbox.wrap('Free Email Providers', (progress) =>
        emailProviderLister.downloadFreeEmailProviders()),

      rawDeals: logbox.wrap('Deals', (progress) =>
        downloadHubspotEntities(hubspot, DealAdapter, progress)),

      rawCompanies: logbox.wrap('Companies', (progress) =>
        downloadHubspotEntities(hubspot, CompanyAdapter, progress)),

      rawContacts: logbox.wrap('Contacts', (progress) =>
        downloadHubspotEntities(hubspot, ContactAdapter, progress)),
    });

    logbox.done();
    log.info('Downloader', 'Done');

    return data;
  }

}
