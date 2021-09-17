import assert from 'assert';
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
  throw new Error('Function not implemented.');
}

export function dealUpdateProperties(deal: Deal, record: License | Transaction): Partial<Deal['properties']> {
  throw new Error('Function not implemented.');
}
