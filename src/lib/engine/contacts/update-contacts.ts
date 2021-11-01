import config from '../../config/index.js';
import { Database } from '../../model/database.js';
import { SimpleError } from '../../util/errors.js';
import { RelatedLicenseSet } from '../license-matching/license-grouper.js';
import { flagPartnersViaCoworkers } from './contact-types.js';


export function updateContactsBasedOnMatchResults(db: Database, allMatches: RelatedLicenseSet[]) {
  for (const group of allMatches) {
    const contacts = new Set(group.map(m => db.contactManager.getByEmail(m.license.data.technicalContact.email)!));

    flagPartnersViaCoworkers([...contacts]);

    for (const contact of contacts) {
      const items = [
        ...group.map(g => g.license),
        ...group.flatMap(g => g.transactions)
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

      const addonKey = group[0].license.data.addonKey;
      const product = config.mpac.platforms[addonKey];
      if (!product) {
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
