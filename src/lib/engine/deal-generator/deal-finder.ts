import { Deal } from '../../model/deal.js';
import { License } from '../../model/license.js';
import { Transaction } from '../../model/transaction.js';
import { isPresent } from '../../util/helpers.js';

export class DealFinder {

  licenseDeals = new Map<string, Deal>();
  transactionDeals = new Map<string, Deal>();

  constructor(initialDeals: Iterable<Deal>) {
    for (const deal of initialDeals) {
      if (deal.data.addonLicenseId) this.licenseDeals.set(deal.data.addonLicenseId, deal);
      if (deal.data.transactionId) this.transactionDeals.set(deal.data.transactionId, deal);
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
    return (record instanceof Transaction
      ? (
        this.transactionDeals.get(record.data.transactionId) ||
        this.licenseDeals.get(record.data.addonLicenseId)
      )
      : this.licenseDeals.get(record.data.addonLicenseId));
  }

}
