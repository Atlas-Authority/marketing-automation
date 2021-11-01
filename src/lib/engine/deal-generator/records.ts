import assert from 'assert';
import mustache from 'mustache';
import config from '../../config/index.js';
import { Deal, DealData } from '../../model/deal.js';
import { DealStage, Pipeline } from '../../model/hubspot/interfaces.js';
import { License } from '../../model/license.js';
import { Transaction } from '../../model/transaction.js';
import { isPresent, sorter } from "../../util/helpers.js";
import { RelatedLicenseSet } from '../license-matching/license-grouper.js';

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

export function getLicense(addonLicenseId: string, groups: RelatedLicenseSet) {
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

export function dealCreationProperties(record: License | Transaction, data: Pick<DealData, 'addonLicenseId' | 'transactionId' | 'dealstage'>): DealData {
  const dealNameTemplateProperties = {
    ...record.data,
    technicalContactEmail: record.data.technicalContact.email,
  };

  return {
    ...data,
    closeDate: getCloseDate(record),
    deployment: record.data.hosting,
    app: record.data.addonKey,
    licenseTier: record.tier,
    country: record.data.country,
    origin: config.constants.dealOrigin ?? null,
    relatedProducts: config.constants.dealRelatedProducts ?? null,
    dealName: mustache.render(config.constants.dealDealName, dealNameTemplateProperties),
    pipeline: Pipeline.MPAC,
    hasActivity: false,
    amount: (data.dealstage === DealStage.EVAL
      ? null
      : record instanceof License
        ? 0
        : record.data.vendorAmount),
  };
}

export function updateDeal(deal: Deal, record: License | Transaction) {
  if (record instanceof Transaction) {
    deal.data.amount = Math.max(
      deal.data.amount ?? 0,
      record.data.vendorAmount);
  }

  if (!deal.data.amount) {
    deal.data.amount = (deal.isClosed() ? 0 : null);
  }

  deal.data.closeDate = getCloseDate(record);
  deal.data.licenseTier = Math.max(deal.data.licenseTier, record.tier);
}

export function getEmails(item: Transaction | License) {
  return [
    item.data.technicalContact.email,
    item.data.billingContact?.email,
    item.data.partnerDetails?.billingContact.email,
  ].filter(isPresent);
}

function getCloseDate(record: License | Transaction): string {
  return (record instanceof Transaction
    ? record.data.saleDate
    : record.data.maintenanceStartDate);
}
