import assert from 'assert';
import mustache from 'mustache';
import config, { DealStage, Pipeline } from '../../config/index.js';
import { Deal } from '../../model/hubspot/deal.js';
import { License } from '../../model/marketplace/license.js';
import { Transaction } from '../../model/marketplace/transaction.js';
import { isPresent, sorter } from "../../util/helpers.js";
import { LicenseContext } from '../license-grouper.js';

export function isEvalOrOpenSourceLicense(record: License) {
  return (
    record.data.licenseType === 'EVALUATION' ||
    record.data.licenseType === 'OPEN_SOURCE'
  );
}

export function isPaidLicense(license: License) {
  return (
    license.data.licenseType === 'ACADEMIC' ||
    license.data.licenseType === 'COMMERCIAL' ||
    license.data.licenseType === 'COMMUNITY' ||
    license.data.licenseType === 'DEMONSTRATION'
  );
}

export function getLicense(addonLicenseId: string, groups: LicenseContext[]) {
  const license = (groups
    .map(g => g.license)
    .sort(sorter(l => l.data.maintenanceStartDate, 'DSC'))
    .find(l => l.data.addonLicenseId === addonLicenseId));
  assert.ok(license);
  return license;
}

export function abbrRecordDetails(record: Transaction | License) {
  return {
    hosting: record.data.hosting,
    sen: record.data.addonLicenseId,
    date: record.data.maintenanceStartDate,
    type: record.data.licenseType,
    ...(record instanceof Transaction && {
      sale: record.data.saleType,
      at: record.data.transactionId,
      amt: record.data.vendorAmount,
    }),
  };
}

export function dealCreationProperties(record: License | Transaction, dealstage: string): Deal['properties'] {
  const dealNameTemplateProperties = {
    ...record.data,
    technicalContactEmail: record.data.technicalContact.email,
  };

  return {
    ...(isLicense(record)
      ? { addonLicenseId: record.addonLicenseId, transactionId: '' }
      : { transactionId: record.transactionId, addonLicenseId: '' }),
    closedate: (isLicense(record)
      ? record.maintenanceStartDate
      : record.purchaseDetails.maintenanceStartDate),
    deployment: (isLicense(record)
      ? record.hosting
      : record.purchaseDetails.hosting),
    aa_app: record.addonKey,
    license_tier: getTier(record).toFixed(),
    country: (isLicense(record)
      ? record.contactDetails.country
      : record.customerDetails.country),
    origin: config.constants.dealOrigin,
    related_products: config.constants.dealRelatedProducts,
    dealname: mustache.render(config.constants.dealDealName, dealNameTemplateProperties),
    dealstage,
    pipeline: Pipeline.AtlassianMarketplace,
    amount: (dealstage === DealStage.EVAL
      ? ''
      : isLicense(record)
        ? '0'
        : record.purchaseDetails.vendorAmount.toString()),
  };
}

export function dealUpdateProperties(deal: Deal, record: License | Transaction): Partial<Deal['properties']> {
  const properties: Partial<Deal['properties']> = {};

  if (isTransaction(record)) {
    if (deal.properties.transactionId !== record.transactionId) properties.transactionId = record.transactionId;
    if (deal.properties.addonLicenseId !== '') properties.addonLicenseId = '';
  }
  else {
    if (deal.properties.addonLicenseId !== record.addonLicenseId) properties.addonLicenseId = record.addonLicenseId;
    if (deal.properties.transactionId !== '') properties.transactionId = '';
  }

  const oldAmount = deal.properties.amount;
  const newAmount = (isTransaction(record) ? record.purchaseDetails.vendorAmount.toString() : oldAmount);
  if (newAmount !== oldAmount) properties.amount = newAmount;

  const oldCloseDate = deal.properties.closedate;
  const newCloseDate = record.data.maintenanceStartDate;
  if (newCloseDate !== oldCloseDate) properties.closedate = newCloseDate;

  const oldTier = +deal.properties.license_tier;
  const newTier = getTier(record);
  if (newTier > oldTier) properties.license_tier = newTier.toFixed();

  return properties;
}

export function getEmails(item: Transaction | License) {
  return [
    item.data.technicalContact.email,
    item.data.billingContact?.email,
    item.data.partnerDetails?.billingContact.email,
  ].filter(isPresent);
}
