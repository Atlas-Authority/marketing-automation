import { ContactInfo, PartnerDetails } from "./common.js";
import { NormalizedLicense } from "./license.js";
import { RawLicense, RawLicenseContact, RawPartnerDetails, RawTransaction, RawTransactionContact } from "./raw.js";
import { NormalizedTransaction } from "./transaction.js";

export type NormalizedRecord = NormalizedLicense | NormalizedTransaction;

function getContactInfo(contactInfo: RawLicenseContact | RawTransactionContact): ContactInfo {
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

function maybeGetContactInfo(contactInfo: RawLicenseContact | RawTransactionContact | undefined): ContactInfo | undefined {
  if (!contactInfo) return undefined;
  return getContactInfo(contactInfo);
}

function getPartnerInfo(info: RawPartnerDetails | undefined): PartnerDetails | undefined {
  if (!info) return undefined;
  return {
    partnerName: info.partnerName,
    partnerType: info.partnerType,
    billingEmail: info.billingContact.email,
    billingName: info.billingContact.name,
  };
}

export function normalizeLicense(license: RawLicense): NormalizedLicense {
  let newEvalData: NormalizedLicense['newEvalData'] | undefined;
  if (license.evaluationLicense) {
    newEvalData = {
      evaluationLicense: license.evaluationLicense,
      daysToConvertEval: license.daysToConvertEval as string,
      evaluationStartDate: license.evaluationStartDate as string,
      evaluationEndDate: license.evaluationEndDate as string,
      evaluationSaleDate: license.evaluationSaleDate as string,
    };
  }

  let parentInfo: NormalizedLicense['parentInfo'] | undefined;
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

    evaluationOpportunitySize: license.evaluationOpportunitySize,

    attribution: license.attribution,

    parentInfo,

    newEvalData,
  };
}

export function normalizeTransaction(transaction: RawTransaction): NormalizedTransaction {
  return {
    type: 'transaction',

    transactionId: transaction.transactionId,

    addonLicenseId: transaction.addonLicenseId,
    licenseId: transaction.licenseId,
    addonKey: transaction.addonKey,
    addonName: transaction.addonName,
    lastUpdated: transaction.lastUpdated,

    technicalContact: getContactInfo(transaction.customerDetails.technicalContact),
    billingContact: maybeGetContactInfo(transaction.customerDetails.billingContact),
    partnerDetails: getPartnerInfo(transaction.partnerDetails),

    company: transaction.customerDetails.company,
    country: transaction.customerDetails.country,
    region: transaction.customerDetails.region,

    tier: transaction.purchaseDetails.tier,
    licenseType: transaction.purchaseDetails.licenseType,
    hosting: transaction.purchaseDetails.hosting,
    maintenanceStartDate: transaction.purchaseDetails.maintenanceStartDate,
    maintenanceEndDate: transaction.purchaseDetails.maintenanceEndDate,

    saleDate: transaction.purchaseDetails.saleDate,
    saleType: transaction.purchaseDetails.saleType,

    billingPeriod: transaction.purchaseDetails.billingPeriod,

    purchasePrice: transaction.purchaseDetails.purchasePrice,
    vendorAmount: transaction.purchaseDetails.vendorAmount,
  };
}
