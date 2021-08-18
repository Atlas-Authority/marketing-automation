interface Deal {
  id: string;
  contactIds: string[];
  properties: {
    aa_app: string;
    addonlicenseid: string;
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

interface DealUpdate {
  id: string;
  properties: Partial<Deal['properties']>;
}

interface DealAssociationPair {
  contactId: string;
  dealId: string;
}
