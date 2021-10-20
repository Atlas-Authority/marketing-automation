import { Company } from "../../types/company.js";
import { Contact, GeneratedContact } from "../../types/contact.js";
import { Deal, DealAssociationPair, DealCompanyAssociationPair, DealUpdate } from "../../types/deal.js";
import { Association, EntityKind, ExistingEntity, NewEntity } from "../hubspot.js";

export interface Uploader {
  /** @deprecated */
  createAllContacts(contacts: Array<{ properties: GeneratedContact }>): Promise<Contact[]>;
  /** @deprecated */
  updateAllContacts(contacts: Array<{ id: string; properties: Partial<GeneratedContact> }>): Promise<void>;

  /** @deprecated */
  updateAllCompanies(contacts: Array<{ id: string; properties: Partial<Omit<Company, 'id'>> }>): Promise<void>;

  /** @deprecated */
  createAllDeals(deals: Omit<Deal, 'id'>[]): Promise<Deal[]>;
  /** @deprecated */
  updateAllDeals(deals: DealUpdate[]): Promise<void>;

  /** @deprecated */
  associateDealsWithContacts(fromTos: DealAssociationPair[]): Promise<void>;
  /** @deprecated */
  disassociateDealsFromContacts(fromTos: DealAssociationPair[]): Promise<void>;

  /** @deprecated */
  associateDealsWithCompanies(fromTos: DealCompanyAssociationPair[]): Promise<void>;
  /** @deprecated */
  disassociateDealsFromCompanies(fromTos: DealCompanyAssociationPair[]): Promise<void>;

  /** @deprecated */
  createHubspotEntities(kind: EntityKind, inputs: NewEntity[]): Promise<ExistingEntity[]>;
  /** @deprecated */
  updateHubspotEntities(kind: EntityKind, inputs: ExistingEntity[]): Promise<ExistingEntity[]>;

  createHubspotAssociations(fromKind: EntityKind, toKind: EntityKind, inputs: Association[]): Promise<void>;
  deleteHubspotAssociations(fromKind: EntityKind, toKind: EntityKind, inputs: Association[]): Promise<void>;
}
