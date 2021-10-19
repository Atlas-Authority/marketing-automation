import { Company } from '../../types/company.js';
import { Contact, GeneratedContact } from '../../types/contact.js';
import { Deal, DealAssociationPair, DealCompanyAssociationPair, DealUpdate } from '../../types/deal.js';
import log from '../../log/logger.js';
import { Uploader } from './uploader.js';
import { EntityKind, NewEntity, ExistingEntity, apiFor, Association } from '../hubspot.js';

export default class ConsoleUploader implements Uploader {

  verbose: boolean;

  async createHubspotEntities(kind: EntityKind, inputs: NewEntity[]): Promise<ExistingEntity[]> {
    const objects = inputs.map((o, i) => ({
      properties: o.properties,
      id: (1000000000000 + i).toString(),
    }));
    this.fakeApiConsoleLog(`Fake-created ${kind}s:`, objects);
    return objects;
  }

  async updateHubspotEntities(kind: EntityKind, inputs: ExistingEntity[]): Promise<ExistingEntity[]> {
    this.fakeApiConsoleLog(`Fake-created ${kind}s:`, inputs);
    return inputs;
  }

  async createHubspotAssociations(fromKind: EntityKind, toKind: EntityKind, inputs: Association[]): Promise<void> {
    this.fakeApiConsoleLog(`Fake Associating ${fromKind}s to ${toKind}s:`, inputs);
  }

  async deleteHubspotAssociations(fromKind: EntityKind, toKind: EntityKind, inputs: Association[]): Promise<void> {
    this.fakeApiConsoleLog(`Fake Unassociating ${fromKind}s to ${toKind}s:`, inputs);
  }

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

  async associateDealsWithCompanies(fromTos: DealCompanyAssociationPair[]) {
    this.fakeApiConsoleLog('Fake Associating Deals->Companies:', fromTos);
  }

  async disassociateDealsFromCompanies(fromTos: DealCompanyAssociationPair[]) {
    this.fakeApiConsoleLog('Fake Disassociating Deals->Companies:', fromTos);
  }

  fakeApiConsoleLog(title: string, data: unknown[]) {
    log.info('Fake Uploader', title, this.verbose ? data : data.length);
  }

}
