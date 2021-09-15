interface License {
  addonLicenseId: string,
  licenseId: string,
  addonKey: string,
  addonName: string,
  hosting: 'Server' | 'Cloud' | 'Data Center',
  lastUpdated: string,
  licenseType: 'EVALUATION' | 'COMMERCIAL' | 'COMMUNITY' | 'ACADEMIC' | 'OPEN_SOURCE' | 'DEMONSTRATION' | 'INTERNAL USE',
  maintenanceStartDate: string,
  maintenanceEndDate: string,
  status: 'inactive' | 'active' | 'cancelled',
  tier: string,
  contactDetails: {
    company?: string,
    country: string,
    region: string,
    technicalContact: {
      email: string,
      name?: string,
      phone?: string,
      address1?: string,
      address2?: string,
      city?: string,
      state?: string,
      postcode?: string,
    },
    billingContact?: {
      email: string,
      name?: string,
      phone?: string,
      address1?: string,
      address2?: string,
      city?: string,
      state?: string,
      postcode?: string,
    },
  },
  partnerDetails?: {
    partnerName: string,
    partnerType: string,
    billingContact: {
      email: string,
      name: string,
    },
  },
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
}

type LicenseContext = {
  license: License;
  transactions: Transaction[];
};

/** Related via the matching engine. */
type RelatedLicenseSet = LicenseContext[];
