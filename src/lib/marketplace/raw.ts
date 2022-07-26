import { ContactInfo, PartnerInfo } from "../model/record";

export type RawTransactionContact = {
  email: string;
  name?: string;
};

export type RawPartnerDetails = {
  partnerName: string;
  partnerType?: string;
  billingContact: {
    email: string;
    name: string;
  };
};

export interface RawTransaction {
  transactionId: string;
  addonLicenseId?: string;
  licenseId?: string;
  addonKey: string;
  addonName: string;
  lastUpdated: string;
  customerDetails: {
    company: string;
    country: string;
    region: string;
    technicalContact: RawTransactionContact;
    billingContact?: RawTransactionContact;
  };
  purchaseDetails: {
    saleDate: string;
    tier: string;
    licenseType: 'COMMERCIAL' | 'ACADEMIC' | 'COMMUNITY';
    hosting: 'Cloud' | 'Server' | 'Data Center';
    billingPeriod: string;
    purchasePrice: number;
    vendorAmount: number;
    saleType: 'Renewal' | 'Upgrade' | 'New' | 'Refund';
    maintenanceStartDate: string;
    maintenanceEndDate: string;
  };
  partnerDetails?: RawPartnerDetails;

  appEntitlementId?: string;
  appEntitlementNumber?: string;

}

export type RawLicenseContact = {
  email: string;
  name?: string;
  phone?: string;
  address1?: string;
  address2?: string;
  city?: string;
  state?: string;
  postcode?: string;
};

export interface RawLicense {
  addonLicenseId?: string;
  licenseId?: string;
  addonKey: string;
  addonName: string;
  lastUpdated: string;
  contactDetails: {
    company: string;
    country: string;
    region: string;
    technicalContact: RawLicenseContact;
    billingContact?: RawLicenseContact;
  };
  tier: string;
  licenseType: 'EVALUATION' | 'COMMERCIAL' | 'COMMUNITY' | 'ACADEMIC' | 'OPEN_SOURCE' | 'DEMONSTRATION' | 'INTERNAL USE';
  hosting: 'Server' | 'Cloud' | 'Data Center';
  maintenanceStartDate: string;
  maintenanceEndDate: string;
  partnerDetails?: RawPartnerDetails;
  status: 'inactive' | 'active' | 'cancelled';

  evaluationOpportunitySize?: string;

  attribution?: {
    channel: string;
    referrerDomain?: string;
    campaignName?: string;
    campaignSource?: string;
    campaignMedium?: string;
    campaignContent?: string;
  };

  parentProductBillingCycle?: 'NA' | 'Pending' | 'ANNUAL' | 'MONTHLY';
  parentProductName?: 'NA' | 'Pending' | 'Confluence' | 'Jira';
  installedOnSandbox?: 'NA' | 'Pending' | 'No' | 'Yes';
  parentProductEdition?: 'NA' | 'Pending' | 'Free' | 'Standard' | 'Premium' | 'Enterprise';

  evaluationLicense?: string;
  daysToConvertEval?: string;
  evaluationStartDate?: string;
  evaluationEndDate?: string;
  evaluationSaleDate?: string;

  appEntitlementId?: string;
  appEntitlementNumber?: string;

}

export function getContactInfo(contactInfo: RawLicenseContact | RawTransactionContact): ContactInfo {
  return {
    email: contactInfo.email,
    name: contactInfo.name,
    ...('phone' in contactInfo && { phone: normalizeContactField(contactInfo.phone) }),
    ...('address1' in contactInfo && { address1: normalizeContactField(contactInfo.address1) }),
    ...('address2' in contactInfo && { address2: normalizeContactField(contactInfo.address2) }),
    ...('city' in contactInfo && { city: normalizeContactField(contactInfo.city) }),
    ...('state' in contactInfo && { state: normalizeContactField(contactInfo.state) }),
    ...('postcode' in contactInfo && { postcode: normalizeContactField(contactInfo.postcode) }),
  };
}

export function maybeGetContactInfo(contactInfo: RawLicenseContact | RawTransactionContact | undefined): ContactInfo | null {
  if (!contactInfo) return null;
  return getContactInfo(contactInfo);
}

export function getPartnerInfo(info: RawPartnerDetails | undefined): PartnerInfo | null {
  if (!info) return null;
  return {
    partnerName: info.partnerName,
    partnerType: info.partnerType,
    billingContact: {
      email: info.billingContact.email,
      name: info.billingContact.name,
    },
  };
}

function normalizeContactField(field: string | undefined) {
  if (field === undefined) return undefined;
  if (field === 'null') return undefined;
  const normalized = field.replace(/\r/g, '').trim();
  if (normalized === '') return undefined;
  return normalized;
}
