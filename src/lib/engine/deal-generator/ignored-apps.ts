import config from "../../config/index.js";
import log from "../../log/logger.js";
import { Database } from "../../model/database.js";
import { RelatedLicenseSet } from "../license-matching/license-grouper.js";

export function removeIgnoredApps(db: Database, relatedLicenseSets: RelatedLicenseSet[]) {
  removeAllFrom(db.licenses, license => license.data, "licenses");
  removeAllFrom(db.transactions, transaction => transaction.data, "transactions");
  removeAllFrom(relatedLicenseSets, set => set[0].license.data, "matches");
}

function removeAllFrom<T>(array: T[], get: (r: T) => { addonKey: string }, name: string) {
  const before = array.length;
  for (let i = array.length - 1; i >= 0; i--) {
    const item = array[i];
    if (hasIgnoredApp(get(item))) {
      array.splice(i, 1);
    }
  }
  const after = array.length;
  log.info("Deal Generator", `Ignoring ${before - after} ${name} leaving ${after}`);
}

function hasIgnoredApp(record: { addonKey: string }) {
  return config.engine.ignoredApps.has(record.addonKey);
}
