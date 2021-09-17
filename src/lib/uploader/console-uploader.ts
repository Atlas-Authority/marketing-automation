import { Company } from '../types/company.js';
import logger from '../util/logger.js';
import { Uploader } from './uploader.js';

export default class ConsoleUploader implements Uploader {

  verbose: boolean;

  constructor({ verbose }: { verbose: boolean }) {
    this.verbose = verbose;
  }

  async createAllContacts(contacts: Array<{ properties: GeneratedContact }>): Promise<Contact[]> {
    const createdContacts = contacts.map((contact, i) => ({
      ...contact.properties,
      otherEmails: [],
      hs_object_id: (1000000000000 + i).toString(),
    }));
    this.fakeApiConsoleLog('Fake-created contacts:', createdContacts);
    return createdContacts;
  }

  async updateAllContacts(contacts: Array<{ id: string; properties: Partial<GeneratedContact> }>) {
    this.fakeApiConsoleLog('Fake-updated contacts:', contacts);
  }

  async updateAllCompanies(companies: Array<{ id: string; properties: Partial<Omit<Company, 'id'>> }>) {
    this.fakeApiConsoleLog('Fake-updated companies:', companies);
  }

  async createAllDeals(deals: Omit<Deal, 'id'>[]): Promise<Deal[]> {
    const createdDeals = deals.map((deal, i) => ({
      ...deal,
      id: (2000000000000 + i).toString(),
    }));
    this.fakeApiConsoleLog('Fake-created deals:', createdDeals);
    return createdDeals;
  }

  async updateAllDeals(deals: DealUpdate[]) {
    this.fakeApiConsoleLog('Fake-updated deals:', deals);
  }

  async associateDealsWithContacts(fromTos: DealAssociationPair[]) {
    this.fakeApiConsoleLog('Fake Associating Deals->Contacts:', fromTos);
  }

  async disassociateDealsFromContacts(fromTos: DealAssociationPair[]) {
    this.fakeApiConsoleLog('Fake Disassociating Deals->Contacts:', fromTos);
  }

  fakeApiConsoleLog(title: string, data: unknown[]) {
    logger.info('Fake Uploader', title, this.verbose ? data : data.length);
  }

}
