import { Deal } from '../../types/deal.js';
import { License } from '../../types/license.js';
import { Transaction } from '../../types/transaction.js';
import { isPresent } from '../../util/helpers.js';
import { isTransaction } from './records.js';

export class DealFinder {

  licenseDeals = new Map<string, Deal>();
  transactionDeals = new Map<string, Deal>();

  constructor(initialDeals: Deal[]) {
    for (const deal of initialDeals) {
      if (deal.properties.addonLicenseId) this.licenseDeals.set(deal.properties.addonLicenseId, deal);
      if (deal.properties.transactionId) this.transactionDeals.set(deal.properties.transactionId, deal);
    }
  }

  getDeal(records: (License | Transaction)[]) {
    return this.getDeals(records).find(deal => deal);
  }

  getDeals(records: (License | Transaction)[]) {
    return (records
      .map(record => this.getById(record))
      .filter(isPresent));
  }

  getById(record: License | Transaction): Deal | undefined {
    return (isTransaction(record)
      ? (
        this.transactionDeals.get(record.transactionId) ||
        this.licenseDeals.get(record.addonLicenseId)
      )
      : this.licenseDeals.get(record.addonLicenseId));
  }

}
