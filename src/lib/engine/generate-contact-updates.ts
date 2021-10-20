import * as assert from 'assert';
import _ from 'lodash';
import { ADDONKEY_TO_PLATFORM } from '../config/index.js';
import { Contact, ContactsByEmail, ContactUpdateAction } from '../types/contact.js';
import { RelatedLicenseSet } from '../types/license.js';
import { SimpleError } from '../util/errors.js';
import { calculateTierFromLicenseContext } from './deal-generator/tiers.js';

const PLATFORMS = _.uniq(Object.values(ADDONKEY_TO_PLATFORM));


export function generateContactUpdateActions(allMatches: RelatedLicenseSet[], contactsByEmail: ContactsByEmail) {
  const contactUpdates = new Map<Contact, { events: Set<string>, products: Set<string>, hostings: Set<'Server' | 'Cloud' | 'Data Center'>, tiers: Set<number> }>();

  for (const group of allMatches) {
    const contacts = _.uniq(group.map(m => contactsByEmail[m.license.contactDetails.technicalContact.email]));

    for (const contact of contacts) {
      if (!contactUpdates.has(contact)) {
        contactUpdates.set(contact, {
          events: new Set(),
          hostings: new Set(),
          products: new Set(),
          tiers: new Set([-1]),
        });
      }

      const updates = contactUpdates.get(contact);
      assert.ok(updates);

      if (typeof contact.license_tier === 'number') {
        updates.tiers.add(contact.license_tier);
      }

      for (const tier of group.flatMap(calculateTierFromLicenseContext)) {
        updates.tiers.add(tier);
      }

      for (const license of group.map(g => g.license)) {
        updates.events.add(license.maintenanceStartDate);
      }

      for (const transaction of group.flatMap(g => g.transactions)) {
        updates.events.add(transaction.purchaseDetails.saleDate);
      }

      const addonKey = group[0].license.addonKey;
      const product = ADDONKEY_TO_PLATFORM[addonKey];
      if (!PLATFORMS.includes(product)) {
        throw new SimpleError(`Add "${addonKey}" to ADDONKEY_PLATFORMS`);
      }

      updates.hostings.add(group[0].license.hosting);
      updates.products.add(product);
    }
  }

  const contactUpdateActions: ContactUpdateAction[] = [];

  for (const [contact, { hostings, products, tiers, events }] of contactUpdates) {
    let deployment: 'Server' | 'Cloud' | 'Data Center' | 'Multiple' | undefined;
    [deployment] = hostings.size > 1 ? ['Multiple'] : hostings;
    assert.ok([null, 'Server', 'Cloud', 'Multiple', 'Data Center'].includes(deployment));

    const related_products = [...products];
    const tier = [...tiers].reduce((a, b) => Math.max(a, b));
    const event = [...events].reduce((a, b) => a > b ? a : b);

    contactUpdateActions.push({ contact, deployment, related_products, tier, event });
  }

  return contactUpdateActions;
}
