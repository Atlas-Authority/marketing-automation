import { ADDONKEY_TO_PLATFORM } from '../config/index.js';
import { Database } from '../model/database.js';
import { SimpleError } from '../util/errors.js';
import { RelatedLicenseSet } from './license-grouper.js';

const PLATFORMS = new Set(Object.values(ADDONKEY_TO_PLATFORM));


export function updateContactsBasedOnMatchResults(db: Database, allMatches: RelatedLicenseSet[]) {
  for (const group of allMatches) {
    const contacts = new Set(group.map(m => db.contactManager.getByEmail(m.license.data.technicalContact.email)!));

    for (const contact of contacts) {
      for (const tier of [
        ...group.flatMap(g => g.license.allTiers()),
        ...group.flatMap(g => g.transactions.map(t => t.parseTier()))
      ]) {
        if (contact.data.licenseTier !== null && tier > contact.data.licenseTier) {
          contact.data.licenseTier = tier;
        }
      }

      for (const item of [
        ...group.map(g => g.license),
        ...group.flatMap(g => g.transactions)
      ]) {
        if (!contact.data.lastMpacEvent || contact.data.lastMpacEvent < item.data.maintenanceStartDate) {
          contact.data.lastMpacEvent = item.data.maintenanceStartDate;
        }
      }

      const addonKey = group[0].license.data.addonKey;
      const product = ADDONKEY_TO_PLATFORM[addonKey];
      if (!PLATFORMS.has(product)) {
        throw new SimpleError(`Add "${addonKey}" to ADDONKEY_PLATFORMS`);
      }
      contact.data.relatedProducts.add(product);

      const hosting = group[0].license.data.hosting;
      if (!contact.data.deployment) {
        contact.data.deployment = hosting;
      }
      else if (contact.data.deployment !== hosting) {
        contact.data.deployment = 'Multiple';
      }
    }
  }
}
