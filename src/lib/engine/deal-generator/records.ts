import assert from 'assert';
import mustache from 'mustache';
import { Deal } from '../../types/deal.js';
import { License, LicenseContext } from '../../types/license.js';
import { Transaction } from '../../types/transaction.js';
import config, { Pipeline } from '../../util/config.js';
import { sorter } from "../../util/helpers.js";
import { parseLicenseTier, parseTransactionTier, tierFromEvalOpportunity } from './tiers.js';

export function isEvalOrOpenSourceLicense(record: License) {
  return (
    record.licenseType === 'EVALUATION' ||
    record.licenseType === 'OPEN_SOURCE'
  );
}

export function isLicense(record: License | Transaction): record is License {
  return 'maintenanceStartDate' in record;
}

export function isTransaction(record: License | Transaction): record is Transaction {
  return 'transactionId' in record;
}

export function isPaidLicense(license: License) {
  return (
    license.licenseType === 'ACADEMIC' ||
    license.licenseType === 'COMMERCIAL' ||
    license.licenseType === 'COMMUNITY' ||
    license.licenseType === 'DEMONSTRATION'
  );
}

export function getDate(record: License | Transaction) {
  return isLicense(record)
    ? record.maintenanceStartDate
    : record.purchaseDetails.maintenanceStartDate;
}

export function getLicenseType(record: License | Transaction) {
  return isLicense(record)
    ? record.licenseType
    : record.purchaseDetails.licenseType;
}

export function getLicense(addonLicenseId: string, groups: LicenseContext[]) {
  const license = (groups
    .map(g => g.license)
    .sort(sorter(l => l.maintenanceStartDate, 'DSC'))
    .find(l => l.addonLicenseId === addonLicenseId));
  assert.ok(license);
  return license;
}

function getTier(record: License | Transaction) {
  return (isTransaction(record)
    ? parseTransactionTier(record.purchaseDetails.tier)
    : Math.max(
      tierFromEvalOpportunity(record.evaluationOpportunitySize),
      parseLicenseTier(record.tier)
    )
  );
}

export function abbrRecordDetails(record: Transaction | License) {
  return (isLicense(record)
    ? {
      hosting: record.hosting,
      sen: record.addonLicenseId,
      date: record.maintenanceStartDate,
      type: record.licenseType,
    }
    : {
      hosting: record.purchaseDetails.hosting,
      sen: record.addonLicenseId,
      date: record.purchaseDetails.maintenanceStartDate,
      type: record.purchaseDetails.licenseType,
      sale: record.purchaseDetails.saleType,
      at: record.transactionId,
      amt: record.purchaseDetails.vendorAmount,
    });
}

export function dealCreationProperties(record: License | Transaction, dealstage: string): Deal['properties'] {
  return {
    ...(isLicense(record)
      ? { addonlicenseid: record.addonLicenseId, transactionid: '' }
      : { transactionid: record.transactionId, addonlicenseid: '' }),
    closedate: (isLicense(record)
      ? record.maintenanceStartDate
      : record.purchaseDetails.maintenanceStartDate),
    deployment: (isLicense(record)
      ? record.hosting
      : record.purchaseDetails.hosting),
    aa_app: record.addonKey,
    license_tier: (isLicense(record)
      ? record.tier
      : record.purchaseDetails.tier),
    country: (isLicense(record)
      ? record.contactDetails.country
      : record.customerDetails.country),
    origin: config.constants.dealOrigin,
    related_products: config.constants.dealRelatedProducts,
    dealname: mustache.render(config.constants.dealDealName, { license: record }),
    dealstage,
    pipeline: Pipeline.AtlassianMarketplace,
    amount: '',
  };
}

export function dealUpdateProperties(deal: Deal, record: License | Transaction): Partial<Deal['properties']> {
  const properties: Partial<Deal['properties']> = {};

  if (isTransaction(record)) {
    if (deal.properties.transactionid !== record.transactionId) properties.transactionid = record.transactionId;
    if (deal.properties.addonlicenseid !== '') properties.addonlicenseid = '';
  }
  else {
    if (deal.properties.addonlicenseid !== record.addonLicenseId) properties.addonlicenseid = record.addonLicenseId;
    if (deal.properties.transactionid !== '') properties.transactionid = '';
  }

  const oldAmount = deal.properties.amount;
  const newAmount = (isTransaction(record) ? record.purchaseDetails.vendorAmount.toString() : oldAmount);
  if (newAmount !== oldAmount) properties.amount = newAmount;

  const oldCloseDate = deal.properties.closedate;
  const newCloseDate = getDate(record);
  if (newCloseDate !== oldCloseDate) properties.closedate = newCloseDate;

  const oldTier = +deal.properties.license_tier;
  const newTier = getTier(record);
  if (newTier > oldTier) properties.license_tier = newTier.toFixed();

  return properties;
}
