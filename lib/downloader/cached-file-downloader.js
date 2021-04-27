import * as datadir from '../util/datadir.js';

/** @implements {Downloader} */
export default class CachedFileDownloader {

  /**
   * @returns {Promise<string[]>}
   */
  async downloadFreeEmailProviders() {
    return datadir.readJsonFile('in', 'domains.json');
  }

  /**
   * @returns {Promise<Transaction[]>}
   */
  async downloadTransactions() {
    return datadir.readJsonFile('in', 'transactions.json');
  }

  /**
   * @returns {Promise<License[]>}
   */
  async downloadLicensesWithoutDataInsights() {
    return datadir.readJsonFile('in', 'licenses-without.json');
  }

  /**
   * @returns {Promise<License[]>}
   */
  async downloadLicensesWithDataInsights() {
    return datadir.readJsonFile('in', 'licenses-with.json');
  }

  /**
   * @returns {Promise<Deal[]>}
   */
  async downloadAllDeals() {
    return datadir.readJsonFile('in', 'deals.json');
  }

  /**
   * @returns {Promise<Company[]>}
   */
  async downloadAllCompanies() {
    return datadir.readJsonFile('in', 'companies.json');
  }

  /**
   * @returns {Promise<Contact[]>}
   */
  async downloadAllContacts() {
    return datadir.readJsonFile('in', 'contacts.json');
  }

}
