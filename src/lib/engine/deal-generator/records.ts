import assert from 'assert';
import mustache from 'mustache';
import config, { Pipeline } from '../../util/config.js';
import { sorter } from "../../util/helpers.js";

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

  const newAmount = (isTransaction(record) ? record.purchaseDetails.vendorAmount : NaN);
  const oldAmount = parseFloat(deal.properties.amount);
  if (newAmount !== oldAmount && !isNaN(newAmount)) properties.amount = newAmount.toString();

  return properties;
}
