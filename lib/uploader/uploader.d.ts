interface Uploader {
  createAllContacts(contacts: Array<{ properties: GeneratedContact }>): Promise<Contact[]>;
  updateAllContacts(contacts: Array<{ id: string; properties: Partial<GeneratedContact> }>): Promise<void>;

  updateAllCompanies(contacts: Array<{ id: string; properties: Partial<Omit<Company, 'id'>> }>): Promise<void>;

  createAllDeals(deals: Omit<Deal, 'id'>[]): Promise<Deal[]>;
  updateAllDeals(deals: DealUpdate[]): Promise<void>;

  associateDealsWithContacts(fromTos: DealAssociationPair[]): Promise<void>;
  disassociateDealsFromContacts(fromTos: DealAssociationPair[]): Promise<void>;
}
