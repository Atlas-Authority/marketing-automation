type TransactionContact = {
  email: string;
  name?: string;
};

export type PartnerDetails = {
  partnerName: string;
  partnerType?: string;
  billingContact: {
    email: string;
    name: string;
  };
};

export interface Transaction {
  transactionId: string,
  addonLicenseId: string,
  licenseId: string,
  addonKey: string,
  addonName: string,
  lastUpdated: string,
  customerDetails: {
    company: string,
    country: string,
    region: string,
    technicalContact: TransactionContact,
    billingContact?: TransactionContact
  },
  purchaseDetails: {
    saleDate: string,
    tier: string,
    licenseType: 'COMMERCIAL' | 'ACADEMIC' | 'COMMUNITY',
    hosting: 'Cloud' | 'Server' | 'Data Center',
    billingPeriod: string,
    purchasePrice: number,
    vendorAmount: number,
    saleType: 'Renewal' | 'Upgrade' | 'New' | 'Refund',
    maintenanceStartDate: string,
    maintenanceEndDate: string,
  },
  partnerDetails?: PartnerDetails,
}
