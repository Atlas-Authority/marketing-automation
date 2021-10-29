import config from "../../config/index.js";
import log from "../../log/logger.js";
import { Database } from "../../model/database.js";
import { License } from "../../model/license.js";
import { Transaction } from "../../model/transaction.js";

export function removeIgnoredApps(db: Database) {
  db.licenses = removeFor(db.licenses, "licenses");
  db.transactions = removeFor(db.transactions, "transactions");
}

function removeFor<T extends License | Transaction>(records: T[], name: string) {
  const before = records.length;
  records = records.filter(r => !isForIgnoredApp(r));
  const after = records.length;
  log.info("Deal Generator", `Ignoring ${before - after} ${name} leaving ${after}`);
  return records;
}

function isForIgnoredApp(record: License | Transaction) {
  return config.engine.ignoredApps.has(record.data.addonKey);
}
