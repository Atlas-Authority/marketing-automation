import { Database } from "../../model/database";
import env from "../../parameters/env";
import { KnownError } from "../../util/errors";
import { RelatedLicenseSet } from "../license-matching/license-grouper";
import { flagPartnersViaCoworkers } from "./contact-types";

export function updateContactsBasedOnMatchResults(db: Database, allMatches: RelatedLicenseSet[]) {
  for (const license of allMatches) {
    const contacts = new Set(license.map(license => db.contactManager.getByEmail(license.data.technicalContact.email)!));

    flagPartnersViaCoworkers([...contacts]);

    for (const contact of contacts) {
      const items = [
        ...license,
        ...license.flatMap(l => l.transactions)
      ];

      for (const tier of items.map(item => item.tier)) {
        if (contact.data.licenseTier !== null && tier > contact.data.licenseTier) {
          contact.data.licenseTier = tier;
        }
      }

      for (const item of items) {
        if (!contact.data.lastMpacEvent || contact.data.lastMpacEvent < item.data.maintenanceStartDate) {
          contact.data.lastMpacEvent = item.data.maintenanceStartDate;
        }
      }

      const addonKey = license[0].data.addonKey;
      const product = env.mpac.platforms[addonKey];
      if (!product) {
        throw new KnownError(`Add "${addonKey}" to ADDONKEY_PLATFORMS`);
      }
      if (!env.engine.ignoredApps.has(addonKey)) {
        contact.data.relatedProducts.add(product);
      }

      const hosting = license[0].data.hosting;
      if (!contact.data.deployment) {
        contact.data.deployment = hosting;
      }
      else if (contact.data.deployment !== hosting) {
        contact.data.deployment = 'Multiple';
      }
    }
  }
}
