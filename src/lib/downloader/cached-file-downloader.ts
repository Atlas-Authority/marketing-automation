import { Company } from '../types/company.js';
import { Contact } from '../types/contact.js';
import { Deal } from '../types/deal.js';
import { Transaction } from '../types/transaction.js';
import * as datadir from '../util/datadir.js';
import { Downloader } from './downloader.js';

export default class CachedFileDownloader implements Downloader {

  async downloadFreeEmailProviders(): Promise<string[]> {
    return datadir.readJsonFile('in', 'domains.json');
  }

  async downloadAllTlds(): Promise<string[]> {
    return datadir.readJsonFile('in', 'tlds.json');
  }

  async downloadTransactions(): Promise<Transaction[]> {
    return datadir.readJsonFile('in', 'transactions.json');
  }

  async downloadLicensesWithoutDataInsights(): Promise<License[]> {
    return datadir.readJsonFile('in', 'licenses-without.json');
  }

  async downloadLicensesWithDataInsights(): Promise<License[]> {
    return datadir.readJsonFile('in', 'licenses-with.json');
  }

  async downloadAllDeals(): Promise<Deal[]> {
    return datadir.readJsonFile('in', 'deals.json');
  }

  async downloadAllCompanies(): Promise<Company[]> {
    return datadir.readJsonFile('in', 'companies.json');
  }

  async downloadAllContacts(): Promise<Contact[]> {
    return datadir.readJsonFile('in', 'contacts.json');
  }

}
