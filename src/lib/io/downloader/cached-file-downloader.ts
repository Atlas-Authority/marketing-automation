import * as datadir from '../../cache/datadir.js';
import { Company } from '../../types/company.js';
import { Contact } from '../../types/contact.js';
import { Deal } from '../../types/deal.js';
import { License } from '../../types/license.js';
import { Transaction } from '../../types/transaction.js';
import { Downloader, DownloadLogger } from './downloader.js';

export default class CachedFileDownloader implements Downloader {

  async downloadFreeEmailProviders(downloadLogger: DownloadLogger): Promise<string[]> {
    downloadLogger.prepare(1);
    const data = datadir.readJsonFile('in', 'domains.json');
    downloadLogger.tick();
    return data;
  }

  async downloadAllTlds(downloadLogger: DownloadLogger): Promise<string[]> {
    downloadLogger.prepare(1);
    const data = datadir.readJsonFile('in', 'tlds.json');
    downloadLogger.tick();
    return data;
  }

  async downloadTransactions(downloadLogger: DownloadLogger): Promise<Transaction[]> {
    downloadLogger.prepare(1);
    const data = datadir.readJsonFile('in', 'transactions.json');
    downloadLogger.tick();
    return data;
  }

  async downloadLicensesWithoutDataInsights(downloadLogger: DownloadLogger): Promise<License[]> {
    downloadLogger.prepare(1);
    const data = datadir.readJsonFile('in', 'licenses-without.json');
    downloadLogger.tick();
    return data;
  }

  async downloadLicensesWithDataInsights(downloadLogger: DownloadLogger): Promise<License[]> {
    downloadLogger.prepare(1);
    const data = datadir.readJsonFile('in', 'licenses-with.json');
    downloadLogger.tick();
    return data;
  }

  async downloadAllDeals(downloadLogger: DownloadLogger): Promise<Deal[]> {
    downloadLogger.prepare(1);
    const data = datadir.readJsonFile('in', 'deals.json');
    downloadLogger.tick();
    return data;
  }

  async downloadAllCompanies(downloadLogger: DownloadLogger): Promise<Company[]> {
    downloadLogger.prepare(1);
    const data = datadir.readJsonFile('in', 'companies.json');
    downloadLogger.tick();
    return data;
  }

  async downloadAllContacts(downloadLogger: DownloadLogger): Promise<Contact[]> {
    downloadLogger.prepare(1);
    const data = datadir.readJsonFile('in', 'contacts.json');
    downloadLogger.tick();
    return data;
  }

}
