import promiseAllProperties from 'promise-all-properties';
import { DataSet } from '../data/set';
import { MultiDownloadLogger } from "../log/download-logger";
import log from "../log/logger";
import { CompanyAdapter } from '../model/company';
import { ContactAdapter } from '../model/contact';
import { DealAdapter } from '../model/deal';
import { downloadHubspotEntities } from '../model/hubspot/manager';
import { HubspotCreds, MpacCreds } from "../parameters/interfaces";
import { EmailProviderAPI } from "./free-email-services";
import HubspotAPI from "./hubspot";
import { Data } from "./interfaces";
import { MarketplaceAPI } from "./marketplace";
import { TldListAPI } from "./tlds";

type DownloadConfig = {
  hubspotCreds: HubspotCreds;
  mpacCreds: MpacCreds;
};

export class Downloader {

  constructor(
    private dataSet: DataSet,
    private config: DownloadConfig,
  ) { }

  async downloadData(): Promise<Data> {
    const hubspot = new HubspotAPI(this.config.hubspotCreds);
    const marketplace = new MarketplaceAPI(this.config.mpacCreds);
    const emailProviderLister = new EmailProviderAPI();
    const tldLister = new TldListAPI();

    log.info('Downloader', 'Starting downloads with API');
    const logbox = new MultiDownloadLogger();

    const data = await promiseAllProperties({
      tlds: logbox.wrap('Tlds', () =>
        tldLister.downloadAllTlds()),

      licensesWithDataInsights: logbox.wrap('Licenses With Data Insights', (progress) =>
        marketplace.downloadLicensesWithDataInsights(progress)),

      licensesWithoutDataInsights: logbox.wrap('Licenses Without Data Insights', () =>
        marketplace.downloadLicensesWithoutDataInsights()),

      transactions: logbox.wrap('Transactions', () =>
        marketplace.downloadTransactions()),

      freeDomains: logbox.wrap('Free Email Providers', () =>
        emailProviderLister.downloadFreeEmailProviders()),

      rawDeals: logbox.wrap('Deals', () =>
        downloadHubspotEntities(hubspot, DealAdapter)),

      rawCompanies: logbox.wrap('Companies', () =>
        downloadHubspotEntities(hubspot, CompanyAdapter)),

      rawContacts: logbox.wrap('Contacts', () =>
        downloadHubspotEntities(hubspot, ContactAdapter)),
    });

    this.dataSet.save(data);

    logbox.done();
    log.info('Downloader', 'Done');

    return data;
  }

}
