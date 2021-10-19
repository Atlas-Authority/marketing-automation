import { ContactInfo, PartnerDetails } from "./common.js";

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
