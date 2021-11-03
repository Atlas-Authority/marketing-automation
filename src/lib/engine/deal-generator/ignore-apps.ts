import log from "../../log/logger.js";
import { Database } from "../../model/database.js";
import env from "../../parameters/env.js";
import { formatMoney, formatNumber } from "../../util/formatters.js";
import { RelatedLicenseSet } from "../license-matching/license-grouper.js";

export function removeIgnoredApps(db: Database, relatedLicenseSets: RelatedLicenseSet[]) {
  removeAllFrom(db.licenses, license => license.data, "licenses");
  removeAllFrom(db.transactions, transaction => transaction.data, "transactions");
  removeAllFrom(relatedLicenseSets, set => set[0].license.data, "matches");
}

function removeAllFrom<T>(array: T[], get: (r: T) => { addonKey: string, vendorAmount?: number }, name: string) {
  let total = 0;
  const before = array.length;
  for (let i = array.length - 1; i >= 0; i--) {
    const item = array[i];
    const record = get(item);
    if (hasIgnoredApp(record)) {
      total += record.vendorAmount ?? 0;
      array.splice(i, 1);
    }
  }
  const after = array.length;
  const totalAmountStr = total > 0 ? `(total ${formatMoney(total)})` : '';
  log.info("Deal Generator", `Ignoring ${formatNumber(before - after)} ${name} ${totalAmountStr} leaving ${formatNumber(after)}`);
}

function hasIgnoredApp(record: { addonKey: string }) {
  return env.engine.ignoredApps.has(record.addonKey);
}
