import log from "../log/logger.js";
import { Database } from "../model/database.js";
import { formatMoney, formatNumber } from "../util/formatters.js";
import { isPresent } from "../util/helpers.js";

export function printSummary(db: Database) {

  if (db.dealManager.duplicatesToDelete.size > 0) {
    log.warn('Deal Generator',
      'Found duplicate deals; delete them manually',
      [...db.dealManager.duplicatesToDelete].map(([dup, dupOf]) => ({
        "Primary": dupOf.size > 1
          ? [...dupOf].map(d => d.link())
          : dupOf.size === 0
            ? 'Unknown???'
            : [...dupOf][0].link(),
        "Duplicate": dup.link(),
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
    'DealsAssociated': formatNumber(db.dealManager.associatedCount),
    'DealsDisAssociated': formatNumber(db.dealManager.disassociatedCount),

    'ContactsCreated': formatNumber(db.contactManager.createdCount),
    'ContactsUpdated': formatNumber(db.contactManager.updatedCount),
    'ContactsAssociated': formatNumber(db.contactManager.associatedCount),
    'ContactsDisassociated': formatNumber(db.contactManager.disassociatedCount),

    'CompaniesUpdated': formatNumber(db.companyManager.updatedCount),
  });

}
