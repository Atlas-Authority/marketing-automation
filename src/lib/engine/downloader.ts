import promiseAllProperties from 'promise-all-properties';
import { Data, Remote } from '../io/interfaces';
import { MultiDownloadLogger } from "../log/download-logger";
import log from "../log/logger";
import { CompanyAdapter } from '../model/company';
import { ContactAdapter } from '../model/contact';
import { DealAdapter } from '../model/deal';
import { downloadHubspotEntities } from '../model/hubspot/manager';

export async function downloadData(remote: Remote): Promise<Data> {
  log.info('Downloader', 'Starting downloads with API');
  const logbox = new MultiDownloadLogger();

  const data = await promiseAllProperties({
    tlds: logbox.wrap('Tlds', (progress) =>
      remote.tldLister.downloadAllTlds(progress)),

    licensesWithDataInsights: logbox.wrap('Licenses With Data Insights', (progress) =>
      remote.marketplace.downloadLicensesWithDataInsights(progress)),

    licensesWithoutDataInsights: logbox.wrap('Licenses Without Data Insights', (progress) =>
      remote.marketplace.downloadLicensesWithoutDataInsights(progress)),

    transactions: logbox.wrap('Transactions', (progress) =>
      remote.marketplace.downloadTransactions(progress)),

    freeDomains: logbox.wrap('Free Email Providers', (progress) =>
      remote.emailProviderLister.downloadFreeEmailProviders(progress)),

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
