import assert from 'assert';
import mustache from 'mustache';
import log from '../../log/logger.js';
import { Table } from '../../log/table.js';
import { Deal, DealData } from '../../model/deal.js';
import { DealStage, Pipeline } from '../../model/hubspot/interfaces.js';
import { License } from '../../model/license.js';
import { Transaction } from '../../model/transaction.js';
import env from '../../parameters/env.js';
import { formatMoney } from '../../util/formatters.js';
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

export function printDetailedRecords(records: (License | Transaction)[]) {
  log.detailed('Deal Actions', '\n');
  log.detailed('Deal Actions', 'Records');
  const table = new Table([
    { title: 'Hosting' },
    { title: 'AddonLicenseId' },
    { title: 'Date' },
    { title: 'LicenseType' },
    { title: 'SaleType' },
    { title: 'Transaction' },
    { title: 'Amount', align: 'right' },
  ]);
  for (const record of records) {
    table.rows.push([
      record.data.hosting,
      record.data.addonLicenseId,
      record.data.maintenanceStartDate,
      record.data.licenseType,
      record instanceof Transaction ? record.data.saleType : '',
      record instanceof Transaction ? record.data.transactionId : '',
      record instanceof Transaction ? formatMoney(record.data.vendorAmount) : '',
    ]);
  }
  for (const row of table.eachRow()) {
    log.detailed('Deal Actions', '  ' + row);
  }
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
