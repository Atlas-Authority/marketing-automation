import * as assert from 'assert';
import { ContactInfo, getContactInfo, getPartnerInfo, maybeGetContactInfo, PartnerInfo } from "./common.js";
import { RawTransaction } from "./raw.js";

export interface TransactionData {
  addonLicenseId: string,
  licenseId: string,
  addonKey: string,
  addonName: string,
  lastUpdated: string,

  technicalContact: ContactInfo,
  billingContact: ContactInfo | null,
  partnerDetails: PartnerInfo | null,

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

  parseTier() {
    const tier = this.data.tier;

    if (tier === 'Unlimited Users') return 10001;

    let m;
    if (m = tier.match(/^Per Unit Pricing \((\d+) users\)$/i)) {
      return +m[1];
    }
    if (m = tier.match(/^(\d+) Users$/)) {
      return +m[1];
    }

    assert.fail(`Unknown transaction tier: ${tier}`);
  }

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
