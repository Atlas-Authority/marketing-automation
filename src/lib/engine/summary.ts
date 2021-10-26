import log from "../log/logger.js";
import { Database } from "../model/database.js";
import { isPresent } from "../util/helpers.js";

export function printSummary(db: Database) {

  if (db.dealManager.duplicatesToDelete.size > 0) {
    log.warn('Deal Generator',
      'Found duplicate deals; delete them manually',
      [...db.dealManager.duplicatesToDelete].map(deal =>
        `https://app.hubspot.com/contacts/3466897/deal/${deal.id}/`));
  }

  const deals = db.dealManager.getArray();
  log.info('Summary', 'Results of this run:', {
    'TotalDealCount': formatNumber(deals.length),
    'TotalDealSum': formatMoney(deals.map(d => d.data.amount)
      .filter(isPresent)
      .reduce((a, b) => a + b)),

    'DealsCreated': formatNumber(db.dealManager.createdCount),
    'DealsUpdated': formatNumber(db.dealManager.updatedCount),

    'ContactsCreated': formatNumber(db.contactManager.createdCount),
    'ContactsUpdated': formatNumber(db.contactManager.updatedCount),

    'CompaniesUpdated': formatNumber(db.companyManager.updatedCount),
  });

}

function formatNumber(n: number) {
  return new Intl.NumberFormat('en-US').format(n);
}

function formatMoney(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}
