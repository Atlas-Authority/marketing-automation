import { ContactInfo, getContactInfo, getPartnerInfo, maybeGetContactInfo, PartnerDetails } from "./common.js";
import { RawTransaction } from "./raw.js";

export interface TransactionData {
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
  licenseType: 'COMMERCIAL' | 'ACADEMIC' | 'COMMUNITY',
  hosting: 'Server' | 'Cloud' | 'Data Center',
  maintenanceStartDate: string,
  maintenanceEndDate: string,

  transactionId: string,
  saleDate: string,
  saleType: 'Renewal' | 'Upgrade' | 'New' | 'Refund',

  billingPeriod: string,

  purchasePrice: number,
  vendorAmount: number,
}

export class Transaction {
  constructor(public data: TransactionData) { }
}

export function normalizeTransaction(transaction: RawTransaction): Transaction {
  return new Transaction({
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
  });
}
