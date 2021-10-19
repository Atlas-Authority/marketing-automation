import { ContactInfo, getContactInfo, getPartnerInfo, maybeGetContactInfo, PartnerDetails } from "./common.js";
import { RawLicense } from "./raw.js";

export interface NormalizedLicense {
  type: 'license',

  addonLicenseId: string,
  licenseId: string,
  addonKey: string,
  addonName: string,
  lastUpdated: string,

  technicalContact: ContactInfo,
  billingContact: ContactInfo | null,
  partnerDetails: PartnerDetails | null,

  company: string,
  country: string,
  region: string,

  tier: string,
  licenseType: 'COMMERCIAL' | 'ACADEMIC' | 'COMMUNITY' | 'EVALUATION' | 'OPEN_SOURCE' | 'DEMONSTRATION' | 'INTERNAL USE',
  hosting: 'Server' | 'Cloud' | 'Data Center',
  maintenanceStartDate: string,
  maintenanceEndDate: string,

  status: 'inactive' | 'active' | 'cancelled',

  evaluationOpportunitySize: string,

  attribution: {
    channel: string,
    referrerDomain?: string,
    campaignName?: string,
    campaignSource?: string,
    campaignMedium?: string,
    campaignContent?: string,
  } | null,

  parentInfo: {
    parentProductBillingCycle: 'NA' | 'Pending' | 'ANNUAL' | 'MONTHLY',
    parentProductName: 'NA' | 'Pending' | 'Confluence' | 'Jira',
    installedOnSandbox: 'NA' | 'Pending' | 'No' | 'Yes',
    parentProductEdition: 'NA' | 'Pending' | 'Free' | 'Standard' | 'Premium' | 'Enterprise',
  } | null,

  newEvalData: {
    evaluationLicense: string,
    daysToConvertEval: string,
    evaluationStartDate: string,
    evaluationEndDate: string,
    evaluationSaleDate: string,
  } | null,
}

export function normalizeLicense(license: RawLicense): NormalizedLicense {
  let newEvalData: NormalizedLicense['newEvalData'] | null = null;
  if (license.evaluationLicense) {
    newEvalData = {
      evaluationLicense: license.evaluationLicense,
      daysToConvertEval: license.daysToConvertEval as string,
      evaluationStartDate: license.evaluationStartDate as string,
      evaluationEndDate: license.evaluationEndDate as string,
      evaluationSaleDate: license.evaluationSaleDate as string,
    };
  }

  let parentInfo: NormalizedLicense['parentInfo'] | null = null;
  if (license.parentProductBillingCycle
    || license.parentProductName
    || license.installedOnSandbox
    || license.parentProductEdition) {
    parentInfo = {
      parentProductBillingCycle: license.parentProductBillingCycle,
      parentProductName: license.parentProductName,
      installedOnSandbox: license.installedOnSandbox,
      parentProductEdition: license.parentProductEdition,
    } as NormalizedLicense['parentInfo'];
  }

  return {
    type: 'license',

    addonLicenseId: license.addonLicenseId,
    licenseId: license.licenseId,
    addonKey: license.addonKey,
    addonName: license.addonName,
    lastUpdated: license.lastUpdated,

    technicalContact: getContactInfo(license.contactDetails.technicalContact),
    billingContact: maybeGetContactInfo(license.contactDetails.billingContact),
    partnerDetails: getPartnerInfo(license.partnerDetails),

    company: license.contactDetails.company,
    country: license.contactDetails.country,
    region: license.contactDetails.region,

    tier: license.tier,
    licenseType: license.licenseType,
    hosting: license.hosting,
    maintenanceStartDate: license.maintenanceStartDate,
    maintenanceEndDate: license.maintenanceEndDate,

    status: license.status,
    evaluationOpportunitySize: license.evaluationOpportunitySize ?? '',
    attribution: license.attribution ?? null,
    parentInfo,
    newEvalData,
  };
}
