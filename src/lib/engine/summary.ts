import log from "../log/logger.js";
import { Database } from "../model/database.js";
import { isPresent } from "../util/helpers.js";

export function printSummary(db: Database) {
  const deals = db.dealManager.getArray();
  log.info('Summary', 'Deal count:', deals.length);
  log.info('Summary', 'Deal sum:', deals
    .map(d => d.data.amount)
    .filter(isPresent)
    .reduce((a, b) => a + b));
}
