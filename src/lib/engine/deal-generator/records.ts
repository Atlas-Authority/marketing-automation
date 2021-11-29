import * as assert from 'assert';
import * as mustache from 'mustache';
import { LogWriteStream } from '../../cache/datadir.js';
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



export function printRecordDetails(log: LogWriteStream, records: (License | Transaction)[]) {
  const ifTx = (fn: (r: Transaction) => string) =>
    (r: License | Transaction) =>
      r instanceof Transaction ? fn(r) : '';

  log.writeLine('\n');
  Table.print({
    log: str => log.writeLine(str),
    title: 'Records',
    rows: records,
    cols: [
      [{ title: 'Hosting' }, record => record.data.hosting],
      [{ title: 'AddonLicenseId' }, record => record.data.addonLicenseId],
      [{ title: 'Date' }, record => record.data.maintenanceStartDate],
      [{ title: 'LicenseType' }, record => record.data.licenseType],
      [{ title: 'SaleType' }, ifTx(record => record.data.saleType)],
      [{ title: 'Transaction' }, ifTx(record => record.data.transactionId)],
      [{ title: 'Amount', align: 'right' }, ifTx(record => formatMoney(record.data.vendorAmount))],
    ],
  });
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
