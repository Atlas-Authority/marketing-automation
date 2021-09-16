import { isPresent } from '../../util/helpers.js';

export class DealFinder {

  deals = new Map<string, Deal>();

  constructor(initialDeals: Deal[], keyfn: (deal: Deal) => string) {
    for (const deal of initialDeals) {
      const key = keyfn(deal);
      if (key)
        this.deals.set(key, deal);
    }
  }

  getDeal(records: (License | Transaction)[]) {
    return this.getDeals(records).find(deal => deal);
  }

  getDeals(records: (License | Transaction)[]) {
    return (records
      .map(record => this.deals.get(this.idFor(record)))
      .filter(isPresent));
  }

  idFor(record: License | Transaction): string {
    return ('transactionId' in record
      ? record.transactionId
      : record.addonLicenseId);
  }
}
