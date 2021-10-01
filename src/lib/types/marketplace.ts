type RawTransactionContact = {
  email: string;
  name?: string;
};

type PartnerDetails = {
  partnerName: string;
  partnerType?: string;
  billingContact: {
    email: string;
    name: string;
  };
};

export interface RawTransaction {
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
    technicalContact: RawTransactionContact,
    billingContact?: RawTransactionContact
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

type RawLicenseContact = {
  email: string,
  name?: string,
  phone?: string,
  address1?: string,
  address2?: string,
  city?: string,
  state?: string,
  postcode?: string,
};

export interface RawLicense {
  addonLicenseId: string,
  licenseId: string,
  addonKey: string,
  addonName: string,
  lastUpdated: string,
  contactDetails: {
    company: string,
    country: string,
    region: string,
    technicalContact: RawLicenseContact,
    billingContact?: RawLicenseContact,
  },
  tier: string,
  licenseType: 'EVALUATION' | 'COMMERCIAL' | 'COMMUNITY' | 'ACADEMIC' | 'OPEN_SOURCE' | 'DEMONSTRATION' | 'INTERNAL USE',
  hosting: 'Server' | 'Cloud' | 'Data Center',
  maintenanceStartDate: string,
  maintenanceEndDate: string,
  partnerDetails?: PartnerDetails,
  status: 'inactive' | 'active' | 'cancelled',

  evaluationOpportunitySize?: string,

  attribution?: {
    channel: string,
    referrerDomain?: string,
    campaignName?: string,
    campaignSource?: string,
    campaignMedium?: string,
    campaignContent?: string,
  },

  parentProductBillingCycle?: 'NA' | 'Pending' | 'ANNUAL' | 'MONTHLY',
  parentProductName?: 'NA' | 'Pending' | 'Confluence' | 'Jira',
  installedOnSandbox?: 'NA' | 'Pending' | 'No' | 'Yes',
  parentProductEdition?: 'NA' | 'Pending' | 'Free' | 'Standard' | 'Premium' | 'Enterprise',

  evaluationLicense?: string,
  daysToConvertEval?: string,
  evaluationStartDate?: string,
  evaluationEndDate?: string,
  evaluationSaleDate?: string,
}
