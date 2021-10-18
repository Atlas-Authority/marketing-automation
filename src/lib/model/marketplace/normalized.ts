type ContactInfo = {
  email: string,
  name?: string,
  phone?: string,
  address1?: string,
  address2?: string,
  city?: string,
  state?: string,
  postcode?: string,
};

type PartnerDetails = {
  partnerName: string;
  partnerType?: string;
  billingEmail: string;
  billingName: string;
};

export interface NormalizedLicense {
  type: 'license',

  addonLicenseId: string,
  licenseId: string,
  addonKey: string,
  addonName: string,
  lastUpdated: string,

  technicalContact: ContactInfo,
  billingContact?: ContactInfo,
  partnerDetails?: PartnerDetails,

  company: string,
  country: string,
  region: string,

  tier: string,
  licenseType: 'COMMERCIAL' | 'ACADEMIC' | 'COMMUNITY' | 'EVALUATION' | 'OPEN_SOURCE' | 'DEMONSTRATION' | 'INTERNAL USE',
  hosting: 'Server' | 'Cloud' | 'Data Center',
  maintenanceStartDate: string,
  maintenanceEndDate: string,

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

  parentInfo?: {
    parentProductBillingCycle: 'NA' | 'Pending' | 'ANNUAL' | 'MONTHLY',
    parentProductName: 'NA' | 'Pending' | 'Confluence' | 'Jira',
    installedOnSandbox: 'NA' | 'Pending' | 'No' | 'Yes',
    parentProductEdition: 'NA' | 'Pending' | 'Free' | 'Standard' | 'Premium' | 'Enterprise',
  },

  newEvalData?: {
    evaluationLicense: string,
    daysToConvertEval: string,
    evaluationStartDate: string,
    evaluationEndDate: string,
    evaluationSaleDate: string,
  },
}

export interface NormalizedTransaction {
  type: 'transaction',

  transactionId: string,

  addonLicenseId: string,
  licenseId: string,
  addonKey: string,
  addonName: string,
  lastUpdated: string,

  technicalContact: ContactInfo,
  billingContact?: ContactInfo,
  partnerDetails?: PartnerDetails,

  company: string,
  country: string,
  region: string,

  tier: string,
  licenseType: 'COMMERCIAL' | 'ACADEMIC' | 'COMMUNITY',
  hosting: 'Server' | 'Cloud' | 'Data Center',
  maintenanceStartDate: string,
  maintenanceEndDate: string,

  saleDate: string,
  saleType: 'Renewal' | 'Upgrade' | 'New' | 'Refund',

  billingPeriod: string,

  purchasePrice: number,
  vendorAmount: number,
}

export type NormalizedRecord = NormalizedLicense | NormalizedTransaction;
