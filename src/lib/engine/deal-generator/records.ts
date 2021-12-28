import mustache from 'mustache';
import { Deal, DealData } from '../../model/deal';
import { DealStage, Pipeline } from '../../model/hubspot/interfaces';
import { License } from '../../model/license';
import { Transaction } from '../../model/transaction';
import env from '../../parameters/env';
import { isPresent } from '../../util/helpers';

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
