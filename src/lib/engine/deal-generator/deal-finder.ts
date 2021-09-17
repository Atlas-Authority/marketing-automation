import { isPresent } from '../../util/helpers.js';
import { isTransaction } from './records.js';

export class DealFinder {

  licenseDeals = new Map<string, Deal>();
  transactionDeals = new Map<string, Deal>();

  constructor(initialDeals: Deal[]) {
    for (const deal of initialDeals) {
      if (deal.properties.addonlicenseid) this.licenseDeals.set(deal.properties.addonlicenseid, deal);
      if (deal.properties.transactionid) this.transactionDeals.set(deal.properties.transactionid, deal);
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
      ? this.transactionDeals.get(record.transactionId)
      : this.licenseDeals.get(record.addonLicenseId));
  }

}
