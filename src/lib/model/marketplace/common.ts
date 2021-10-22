import { RawLicenseContact, RawPartnerDetails, RawTransactionContact } from "./raw.js";

export type ContactInfo = {
  email: string,
  name?: string,
  phone?: string,
  address1?: string,
  address2?: string,
  city?: string,
  state?: string,
  postcode?: string,
};

export type PartnerBillingInfo = {
  email: string;
  name: string;
};

export type PartnerInfo = {
  billingContact: PartnerBillingInfo;
  partnerName: string;
  partnerType?: string;
};

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
