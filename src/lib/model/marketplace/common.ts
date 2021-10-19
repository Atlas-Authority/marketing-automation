import { RawLicenseContact, RawTransactionContact, RawPartnerDetails } from "./raw.js";

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

export type PartnerDetails = {
  partnerName: string;
  partnerType?: string;
  billingEmail: string;
  billingName: string;
};

// export type NormalizedRecord = NormalizedLicense | NormalizedTransaction;

export function getContactInfo(contactInfo: RawLicenseContact | RawTransactionContact): ContactInfo {
  return {
    email: contactInfo.email,
    name: contactInfo.name,
    phone: 'phone' in contactInfo ? contactInfo.phone : undefined,
    address1: 'address1' in contactInfo ? contactInfo.address1 : undefined,
    address2: 'address2' in contactInfo ? contactInfo.address2 : undefined,
    city: 'city' in contactInfo ? contactInfo.city : undefined,
    state: 'state' in contactInfo ? contactInfo.state : undefined,
    postcode: 'postcode' in contactInfo ? contactInfo.postcode : undefined,
  };
}

export function maybeGetContactInfo(contactInfo: RawLicenseContact | RawTransactionContact | undefined): ContactInfo | undefined {
  if (!contactInfo) return undefined;
  return getContactInfo(contactInfo);
}

export function getPartnerInfo(info: RawPartnerDetails | undefined): PartnerDetails | undefined {
  if (!info) return undefined;
  return {
    partnerName: info.partnerName,
    partnerType: info.partnerType,
    billingEmail: info.billingContact.email,
    billingName: info.billingContact.name,
  };
}
