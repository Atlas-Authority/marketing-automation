import * as assert from 'assert';
import _ from 'lodash';
import mustache from 'mustache';
import { ContactsByEmail } from '../types/contact.js';
import { Deal, DealUpdate } from '../types/deal.js';
import { License, LicenseContext, RelatedLicenseSet } from '../types/license.js';
import { Transaction } from '../types/transaction.js';
import config, { Pipeline } from '../util/config/index.js';
import { isPresent, sorter } from '../util/helpers.js';
import { saveForInspection } from '../util/inspection.js';
import log from '../util/logger.js';
import { ActionGenerator, CreateDealAction, UpdateDealAction } from './deal-generator/actions.js';
import { DealFinder } from './deal-generator/deal-finder.js';
import { EventGenerator } from './deal-generator/events.js';
import { getEmails } from './deal-generator/records.js';
import { calculateTierFromLicenseContext } from './deal-generator/tiers.js';

function dealPropertiesFor(groups: LicenseContext[]): Omit<Deal['properties'], 'dealstage'> {
  // TODO: use all the groups
  const { license, transactions } = groups[0];

  const tiers = calculateTierFromLicenseContext({ license, transactions });
  const tier = Math.max(...tiers);

  const firstPaidTransaction = (
    transactions
      .sort(sorter(tx => tx.purchaseDetails.saleDate, 'ASC'))
      .find(tx => tx.purchaseDetails.saleType !== 'Refund')
  );

  const amount = firstPaidTransaction?.purchaseDetails.vendorAmount ?? 0;

  return {
    addonlicenseid: license.addonLicenseId,
    transactionid: '',
    closedate: (
      transactions.map(tx => tx.purchaseDetails.saleDate).sort()[0]
      || license.maintenanceStartDate),
    deployment: license.hosting,
    aa_app: license.addonKey,
    license_tier: tier.toFixed(),
    country: license.contactDetails.country,
    origin: config.constants.dealOrigin,
    related_products: config.constants.dealRelatedProducts,
    dealname: mustache.render(config.constants.dealDealName, { license }),
    pipeline: Pipeline.AtlassianMarketplace,
    amount: amount.toString(),
  };
}

function contactIdsFor(contacts: ContactsByEmail, groups: LicenseContext[]) {
  return (_.uniq(
    groups
      .flatMap(group => [group.license, ...group.transactions])
      .flatMap(getEmails)
  )
    .map(email => contacts[email])
    .filter(isPresent)
    .map(c => c.hs_object_id));
}

export function generateDeals(data: {
  allMatches: RelatedLicenseSet[],
  initialDeals: Deal[],
  contactsByEmail: ContactsByEmail,
  providerDomains: Set<string>,
  partnerDomains: Set<string>,
}) {
  const { dealCreateActions, dealUpdateActions } = generateDealActions({
    matches: data.allMatches
      .filter(group =>
        group.some(m =>
          !olderThan90Days(m.license.maintenanceStartDate))),
    initialDeals: data.initialDeals,
    providerDomains: data.providerDomains,
    partnerDomains: data.partnerDomains,
  });

  const dealsToCreate: Omit<Deal, 'id'>[] = dealCreateActions.map(({ groups, properties }) => {
    const contactIds = contactIdsFor(data.contactsByEmail, groups);
    return { contactIds, properties };
  });

  const dealsToUpdate: DealUpdate[] = [];

  const associationsToCreate: Array<{ contactId: string, dealId: string }> = [];
  const associationsToRemove: Array<{ contactId: string, dealId: string }> = [];

  for (const { deal: oldDeal, properties, groups } of dealUpdateActions) {
    // Start with deal->contact associations

    const oldAssociatedContactIds = oldDeal['contactIds'];
    const newAssociatedContactIds = contactIdsFor(data.contactsByEmail, groups);
    assert.ok(newAssociatedContactIds);

    const creatingAssociatedContactIds = newAssociatedContactIds.filter(id => !oldAssociatedContactIds.includes(id));
    const removingAssociatedContactIds = oldAssociatedContactIds.filter(id => !newAssociatedContactIds.includes(id));

    if (creatingAssociatedContactIds.length > 0) associationsToCreate.push(...creatingAssociatedContactIds.map(contactId => ({ contactId, dealId: oldDeal.id })));
    if (removingAssociatedContactIds.length > 0) associationsToRemove.push(...removingAssociatedContactIds.map(contactId => ({ contactId, dealId: oldDeal.id })));

    // Now deal with deal

    const generatedProperties = dealPropertiesFor(groups);
    const newDeal: DealUpdate = {
      id: oldDeal.id,
      properties: {
        ...generatedProperties,
        ...properties,
      },
    };

    for (const [key, val] of Object.entries(newDeal.properties)) {
      const typedKey = key as keyof Deal['properties'];
      if (val === oldDeal.properties[typedKey]) {
        delete newDeal.properties[typedKey];
      }
    }

    if (Object.keys(newDeal.properties).length > 0) {
      dealsToUpdate.push(newDeal);
    }
  }

  return { dealsToCreate, dealsToUpdate, associationsToCreate, associationsToRemove };
}

/** Generates deal actions based on match data */
class DealActionGenerator {

  actionGenerator: ActionGenerator;
  dealFinder: DealFinder;

  dealCreateActions: CreateDealAction[] = [];
  dealUpdateActions: UpdateDealAction[] = [];

  ignoredLicenseSets: (License & { reason: string })[][] = [];

  constructor(private providerDomains: Set<string>, private partnerDomains: Set<string>, initialDeals: Deal[]) {
    this.dealFinder = new DealFinder(initialDeals);
    this.actionGenerator = new ActionGenerator(this.dealFinder);
  }

  generateActionsForMatchedGroup(groups: RelatedLicenseSet) {
    assert.ok(groups.length > 0);
    if (this.ignoring(groups)) return;

    const events = new EventGenerator().interpretAsEvents(groups);
    const actions = this.actionGenerator.generateFrom(events);
    log.detailed('Deal Actions', 'Generated deal actions', actions);

    for (const action of actions) {
      switch (action.type) {
        case 'create': this.dealCreateActions.push(action); break;
        case 'update': this.dealUpdateActions.push(action); break;
      }
    }
  }

  /** Ignore if every license's tech contact domain is partner or mass-provider */
  ignoring(groups: RelatedLicenseSet) {
    const licenses = groups.map(g => g.license);
    const domains = licenses.map(license => license.contactDetails.technicalContact.email.toLowerCase().split('@')[1]);
    const badDomains = domains.filter(domain => this.partnerDomains.has(domain) || this.providerDomains.has(domain));

    if (badDomains.length === licenses.length) {
      this.ignoreLicenses('bad-domains:' + _.uniq(badDomains).join(','), licenses);
      return true;
    }

    return false;
  }

  ignoreLicenses(reason: string, licenses: License[]) {
    this.ignoredLicenseSets.push(licenses.map(license => ({ reason, ...license })));
  }

}

function generateDealActions(data: {
  matches: RelatedLicenseSet[],
  initialDeals: Deal[],
  providerDomains: Set<string>,
  partnerDomains: Set<string>,
}) {
  const generator = new DealActionGenerator(data.providerDomains, data.partnerDomains, data.initialDeals);

  // Stages:
  // 1. Sort and normalize licenses/transactions (event records)
  // 2. Turn event records into deal-generating-relevant events
  // 3. Match events up with deal state and generate actions

  for (const relatedLicenseIds of data.matches) {
    generator.generateActionsForMatchedGroup(relatedLicenseIds);
  }

  saveForInspection('ignored', generator.ignoredLicenseSets);

  return {
    dealCreateActions: generator.dealCreateActions,
    dealUpdateActions: generator.dealUpdateActions,
  };
}

const NINETY_DAYS_AS_MS = (1000 * 60 * 60 * 24 * 90);

export function olderThan90Days(dateString: string) {
  const now = Date.now();
  const then = new Date(dateString).getTime();
  return (now - then > NINETY_DAYS_AS_MS);
}
