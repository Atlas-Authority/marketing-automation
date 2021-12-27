import assert from 'assert';
import mustache from 'mustache';
import { Deal, DealData } from '../../model/deal';
import { DealStage, Pipeline } from '../../model/hubspot/interfaces';
import { License } from '../../model/license';
import { Transaction } from '../../model/transaction';
import env from '../../parameters/env-config';
import { isPresent, sorter } from '../../util/helpers';
import { RelatedLicenseSet } from '../license-matching/license-grouper';

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

export function getLicense(addonLicenseId: string, records: (License | Transaction)[]) {
  const license = (records
    .filter((r => r instanceof License) as
      (r: License | Transaction) => r is License)
    .sort(sorter(l => l.data.maintenanceStartDate, 'DSC'))
    .find(l => l.data.addonLicenseId === addonLicenseId));
  assert.ok(license);
  return license;
}

export function dealCreationProperties(record: License | Transaction, data: Pick<DealData, 'addonLicenseId' | 'transactionId' | 'dealStage'>): DealData {
  return {
    ...data,
    closeDate: (record instanceof Transaction
      ? record.data.saleDate
      : record.data.maintenanceStartDate),
    deployment: record.data.hosting,
    app: record.data.addonKey,
    licenseTier: record.tier,
    country: record.data.country,
    origin: env.hubspot.deals.dealOrigin ?? null,
    relatedProducts: env.hubspot.deals.dealRelatedProducts ?? null,
    dealName: mustache.render(env.hubspot.deals.dealDealName, record.data),
    pipeline: Pipeline.MPAC,
    associatedPartner: null,
    amount: (data.dealStage === DealStage.EVAL
      ? null
      : record instanceof License
        ? 0
        : record.data.vendorAmount),
  };
}

export function updateDeal(deal: Deal, record: License | Transaction) {
  const data = dealCreationProperties(record, {
    addonLicenseId: deal.data.addonLicenseId,
    transactionId: deal.data.transactionId,
    dealStage: deal.data.dealStage,
  });
  Object.assign(deal.data, data);
  deal.data.licenseTier = Math.max(deal.data.licenseTier ?? -1, record.tier);
}

export function getEmails(item: Transaction | License) {
  return [
    item.data.technicalContact.email,
    item.data.billingContact?.email,
    item.data.partnerDetails?.billingContact.email,
  ].filter(isPresent);
}
