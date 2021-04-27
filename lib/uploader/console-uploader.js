import * as logger from '../util/logger.js';

/** @implements {Uploader} */
export default class ConsoleUploader {

  /**
   * @param {object}  options
   * @param {boolean} options.verbose
   */
  constructor({ verbose }) {
    this.verbose = verbose;
  }

  /**
   * @param {Array<{ properties: GeneratedContact }>} contacts
   * @returns {Promise<Contact[]>}
   */
  async createAllContacts(contacts) {
    const createdContacts = contacts.map((contact, i) => ({
      ...contact.properties,
      otherEmails: [],
      hs_object_id: (1000000000000 + i).toString(),
    }));
    this.fakeApiConsoleLog('Fake-created contacts:', createdContacts);
    return createdContacts;
  }

  /**
   * @param {Array<{ id: string; properties: Partial<GeneratedContact> }>} contacts
   */
  async updateAllContacts(contacts) {
    this.fakeApiConsoleLog('Fake-updated contacts:', contacts);
  }

  /**
   * @param {Array<{ id: string; properties: Partial<Omit<Company, 'id'>> }>} companies
   */
  async updateAllCompanies(companies) {
    this.fakeApiConsoleLog('Fake-updated companies:', companies);
  }

  /**
   * @param {Omit<Deal, 'id'>[]} deals
   * @returns {Promise<Deal[]>}
   */
  async createAllDeals(deals) {
    const createdDeals = deals.map((deal, i) => ({
      ...deal,
      id: (2000000000000 + i).toString(),
    }));
    this.fakeApiConsoleLog('Fake-created deals:', createdDeals);
    return createdDeals;
  }

  /**
   * @param {DealUpdate[]} deals
   */
  async updateAllDeals(deals) {
    this.fakeApiConsoleLog('Fake-updated deals:', deals);
  }

  /** @param {DealAssociationPair[]} fromTos */
  async associateDealsWithContacts(fromTos) {
    this.fakeApiConsoleLog('Fake Associating Deals->Contacts:', fromTos);
  }

  /** @param {DealAssociationPair[]} fromTos */
  async disassociateDealsFromContacts(fromTos) {
    this.fakeApiConsoleLog('Fake Disassociating Deals->Contacts:', fromTos);
  }

  /**
   * @param {string} title
   * @param {unknown[]} data
   */
  fakeApiConsoleLog(title, data) {
    logger.info('Fake Uploader', title, this.verbose ? data : data.length);
  }

}
