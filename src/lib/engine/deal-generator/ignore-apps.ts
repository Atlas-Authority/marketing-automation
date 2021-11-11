import log from "../../log/logger.js";
import { Database } from "../../model/database.js";
import env from "../../parameters/env.js";
import { formatMoney, formatNumber } from "../../util/formatters.js";
import { split } from "../../util/helpers.js";
import { RelatedLicenseSet } from "../license-matching/license-grouper.js";

export function removeIgnoredApps(db: Database, relatedLicenseSets: RelatedLicenseSet[]) {
  let ignored: number;

  [db.licenses] = removeAllFrom(db.licenses, license => license.data, "licenses");
  [db.transactions, ignored] = removeAllFrom(db.transactions, transaction => transaction.data, "transactions");
  [relatedLicenseSets] = removeAllFrom(relatedLicenseSets, set => set[0].license.data, "matches");

  db.tallier.less('Skipped archived apps', ignored);
  log.info("Deal Generator", `Ignoring ${formatMoney(ignored)} of archived app transactions`);

  return relatedLicenseSets;
}

function removeAllFrom<T>(array: T[], get: (r: T) => { addonKey: string, vendorAmount?: number }, name: string): [T[], number] {
  const [ignored, good] = split(array, item => hasIgnoredApp(get(item)));

  const totalIgnoredAmount = (ignored
    .map(item => get(item))
    .map(record => record.vendorAmount ?? 0)
    .reduce((a, b) => a + b));

  const totalAmountStr = totalIgnoredAmount > 0 ? `(total ${formatMoney(totalIgnoredAmount)})` : '';
  log.info("Deal Generator", `Ignoring ${formatNumber(ignored.length)} ${name} ${totalAmountStr} leaving ${formatNumber(good.length)}`);

  return [good, totalIgnoredAmount];
}

function hasIgnoredApp(record: { addonKey: string }) {
  return env.engine.ignoredApps.has(record.addonKey);
}
