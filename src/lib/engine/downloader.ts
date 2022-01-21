import promiseAllProperties from 'promise-all-properties';
import { Data } from '../io/interfaces';
import { LiveRemote } from '../io/io';
import { MultiDownloadLogger } from "../log/download-logger";
import log from "../log/logger";
import { CompanyAdapter } from '../model/company';
import { ContactAdapter } from '../model/contact';
import { DealAdapter } from '../model/deal';
import { downloadHubspotEntities } from '../model/hubspot/manager';

export async function downloadData(remote: LiveRemote): Promise<Data> {
  log.info('Downloader', 'Starting downloads with API');
  const logbox = new MultiDownloadLogger();

  const data = await promiseAllProperties({
    tlds: logbox.wrap('Tlds', (progress) =>
      remote.tldLister.downloadAllTlds()),

    licensesWithDataInsights: logbox.wrap('Licenses With Data Insights', (progress) =>
      remote.marketplace.downloadLicensesWithDataInsights(progress)),

    licensesWithoutDataInsights: logbox.wrap('Licenses Without Data Insights', (progress) =>
      remote.marketplace.downloadLicensesWithoutDataInsights()),

    transactions: logbox.wrap('Transactions', (progress) =>
      remote.marketplace.downloadTransactions()),

    freeDomains: logbox.wrap('Free Email Providers', (progress) =>
      remote.emailProviderLister.downloadFreeEmailProviders()),

    rawDeals: logbox.wrap('Deals', (progress) =>
      downloadHubspotEntities(remote.hubspot, DealAdapter, progress)),

    rawCompanies: logbox.wrap('Companies', (progress) =>
      downloadHubspotEntities(remote.hubspot, CompanyAdapter, progress)),

    rawContacts: logbox.wrap('Contacts', (progress) =>
      downloadHubspotEntities(remote.hubspot, ContactAdapter, progress)),
  });

  logbox.done();
  log.info('Downloader', 'Done');

  return data;
}
