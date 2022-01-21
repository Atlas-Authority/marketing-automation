import promiseAllProperties from 'promise-all-properties';
import { Data, Remote } from '../io/interfaces';
import { MemoryHubspot } from '../io/memory/hubspot';
import { MultiDownloadLogger } from "../log/download-logger";
import log from "../log/logger";
import { CompanyManager } from '../model/company';
import { ContactManager } from '../model/contact';
import { DealManager } from '../model/deal';

export async function downloadData(remote: Remote): Promise<Data> {
  const dealManager = new DealManager(remote.hubspot, new MemoryHubspot(null));
  const contactManager = new ContactManager(remote.hubspot, new MemoryHubspot(null));
  const companyManager = new CompanyManager(remote.hubspot, new MemoryHubspot(null));

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
      dealManager.downloadAllEntities(progress)),

    rawCompanies: logbox.wrap('Companies', (progress) =>
      companyManager.downloadAllEntities(progress)),

    rawContacts: logbox.wrap('Contacts', (progress) =>
      contactManager.downloadAllEntities(progress)),
  });

  logbox.done();
  log.info('Downloader', 'Done');

  return data;
}
