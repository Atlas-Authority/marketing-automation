import log from "../log/logger.js";
import { Database } from "../model/database.js";
import { Deal } from "../model/deal.js";
import env from "../parameters/env.js";
import { formatMoney, formatNumber } from "../util/formatters.js";
import { isPresent } from "../util/helpers.js";

export function printSummary(db: Database) {

  if (db.dealManager.duplicatesToDelete.size > 0) {
    log.warn('Deal Generator',
      'Found duplicate deals; delete them manually',
      [...db.dealManager.duplicatesToDelete].map(([dup, dupOf]) => ({
        "Primary": dupOf.size > 1
          ? [...dupOf].map(dealLink)
          : dupOf.size === 0
            ? 'Unknown???'
            : dealLink([...dupOf][0]),
        "Duplicate": dealLink(dup),
      })));
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

function dealLink(deal: Deal) {
  const hsAccountId = env.hubspot.accountId;
  return (hsAccountId
    ? `https://app.hubspot.com/contacts/${hsAccountId}/deal/${deal.id}/`
    : `deal-id=${deal.id}`);
}
