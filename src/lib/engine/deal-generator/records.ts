import assert from 'assert';
import mustache from 'mustache';
import config, { DealStage, Pipeline } from '../../config/index.js';
import { Deal, DealProps } from '../../model/hubspot/deal.js';
import { License } from '../../model/marketplace/license.js';
import { Transaction } from '../../model/marketplace/transaction.js';
import { isPresent, sorter } from "../../util/helpers.js";
import { LicenseContext } from '../license-matching/license-grouper.js';

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

export function dealCreationProperties(record: License | Transaction, dealstage: string): DealProps {
  const dealNameTemplateProperties = {
    ...record.data,
    technicalContactEmail: record.data.technicalContact.email,
  };

  return {
    ...(record instanceof License
      ? { addonLicenseId: record.data.addonLicenseId, transactionId: '' }
      : { transactionId: record.data.transactionId, addonLicenseId: '' }),
    closeDate: record.data.maintenanceStartDate,
    deployment: record.data.hosting,
    aaApp: record.data.addonKey,
    licenseTier: record.maxTier,
    country: record.data.country,
    origin: config.constants.dealOrigin,
    relatedProducts: config.constants.dealRelatedProducts,
    dealName: mustache.render(config.constants.dealDealName, dealNameTemplateProperties),
    dealstage,
    pipeline: Pipeline.AtlassianMarketplace,
    amount: (dealstage === DealStage.EVAL
      ? null
      : record instanceof License
        ? 0
        : record.data.vendorAmount),
  };
}

export function updateDeal(deal: Deal, record: License | Transaction) {
  if (record instanceof Transaction) {
    deal.data.transactionId = record.data.transactionId;
    deal.data.addonLicenseId = null;
  }
  else {
    deal.data.addonLicenseId = record.data.addonLicenseId;
    deal.data.transactionId = null;
  }

  if (record instanceof Transaction) {
    deal.data.amount = record.data.vendorAmount;
  }

  deal.data.closeDate = record.data.maintenanceStartDate;
  deal.data.licenseTier = Math.max(deal.data.licenseTier, record.maxTier);
}

export function getEmails(item: Transaction | License) {
  return [
    item.data.technicalContact.email,
    item.data.billingContact?.email,
    item.data.partnerDetails?.billingContact.email,
  ].filter(isPresent);
}
