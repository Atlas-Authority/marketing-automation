export interface Deal {
  id: string;
  contactIds: string[];
  properties: {
    aa_app: string;
    addonLicenseId: string;
    transactionId: string;
    closedate: string;
    country: string;
    dealname: string;
    deployment: string;
    license_tier: string;
    origin: string;
    related_products: string;
    pipeline: string;
    dealstage: string;
    amount: string;
  };
}

export interface DealUpdate {
  id: string;
  properties: Partial<Deal['properties']>;
}

export interface DealAssociationPair {
  contactId: string;
  dealId: string;
}

export interface DealCompanyAssociationPair {
  companyId: string;
  dealId: string;
}
