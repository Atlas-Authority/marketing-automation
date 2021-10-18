import * as assert from 'assert';
import _ from 'lodash';
import { Contact, ContactsByEmail } from '../types/contact.js';
import { Deal, DealAssociationPair, DealCompanyAssociationPair, DealUpdate } from '../types/deal.js';
import { License, LicenseContext, RelatedLicenseSet } from '../types/license.js';
import { isPresent, sorter } from '../util/helpers.js';
import { saveForInspection } from '../cache/inspection.js';
import log from '../log/logger.js';
import { ActionGenerator, CreateDealAction, UpdateDealAction } from './deal-generator/actions.js';
import { DealFinder } from './deal-generator/deal-finder.js';
import { EventGenerator } from './deal-generator/events.js';
import { getEmails } from './deal-generator/records.js';
import { Uploader } from '../io/uploader/uploader.js';
import { Company } from '../types/company.js';

function contactsFor(contacts: ContactsByEmail, groups: LicenseContext[]) {
  return (_.uniq(
    groups
      .flatMap(group => [group.license, ...group.transactions])
      .flatMap(getEmails)
  )
    .map(email => contacts[email])
    .filter(isPresent))
    .sort(sorter(c => c.contact_type === 'Customer' ? -1 : 0));
}

export async function backfillDealCompanies(input: {
  allMatches: RelatedLicenseSet[],
  deals: Deal[],
  contacts: Contact[],
  uploader: Uploader,
}) {
  const associations: DealCompanyAssociationPair[] = [];

  for (const deal of input.deals) {
    const contacts = deal.contactIds.map(id => {
      const contact = input.contacts.find(c => c.hs_object_id === id);
      assert.ok(contact);
      return contact;
    });

    const customers = contacts.filter(c => c.contact_type === 'Customer');
    const newCompanyIds = customers.map(customer => customer.company_id).filter(isPresent);

    for (const companyId of newCompanyIds) {
      if (!deal.companyIds.includes(companyId)) {
        deal.companyIds.push(companyId);
        associations.push({ dealId: deal.id, companyId });
      }
    }
  }

  if (associations.length > 0) {
    input.uploader.associateDealsWithCompanies(associations);
  }
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
    const contacts = contactsFor(data.contactsByEmail, groups);
    const contactIds = contacts.map(c => c.hs_object_id);
    const companyIds = contacts.filter(c => c.contact_type === 'Customer').map(c => c.company_id).filter(isPresent);
    return { contactIds, properties, companyIds };
  });

  const dealsToUpdate: DealUpdate[] = [];

  const associationsToCreate: DealAssociationPair[] = [];
  const associationsToRemove: DealAssociationPair[] = [];

  const companyAssociationsToCreate: DealCompanyAssociationPair[] = [];
  const companyAssociationsToRemove: DealCompanyAssociationPair[] = [];

  for (const { deal: oldDeal, properties, groups } of dealUpdateActions) {
    // Start with deal->contact associations

    const contacts = contactsFor(data.contactsByEmail, groups);

    const oldAssociatedContactIds = oldDeal.contactIds;
    const newAssociatedContactIds = contacts.map(c => c.hs_object_id);

    const creatingAssociatedContactIds = newAssociatedContactIds.filter(id => !oldAssociatedContactIds.includes(id));
    const removingAssociatedContactIds = oldAssociatedContactIds.filter(id => !newAssociatedContactIds.includes(id));

    if (creatingAssociatedContactIds.length > 0) associationsToCreate.push(...creatingAssociatedContactIds.map(contactId => ({ contactId, dealId: oldDeal.id })));
    if (removingAssociatedContactIds.length > 0) associationsToRemove.push(...removingAssociatedContactIds.map(contactId => ({ contactId, dealId: oldDeal.id })));

    // Now deal with deal->company associations

    const oldAssociatedCompanyIds = oldDeal.companyIds;
    const newAssociatedCompanyIds = contacts.filter(c => c.contact_type === 'Customer').map(c => c.company_id).filter(isPresent);

    const creatingAssociatedCompanyIds = newAssociatedCompanyIds.filter(id => !oldAssociatedCompanyIds.includes(id));
    const removingAssociatedCompanyIds = oldAssociatedCompanyIds.filter(id => !newAssociatedCompanyIds.includes(id));

    if (creatingAssociatedCompanyIds.length > 0) companyAssociationsToCreate.push(...creatingAssociatedCompanyIds.map(companyId => ({ companyId, dealId: oldDeal.id })));
    if (removingAssociatedCompanyIds.length > 0) companyAssociationsToRemove.push(...removingAssociatedCompanyIds.map(companyId => ({ companyId, dealId: oldDeal.id })));

    // Now deal with deal

    const newDeal: DealUpdate = {
      id: oldDeal.id,
      properties,
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

  return {
    dealsToCreate, dealsToUpdate,
    associationsToCreate, associationsToRemove,
    companyAssociationsToCreate, companyAssociationsToRemove,
  };
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
        case 'ignore': this.ignoreLicenses(action.reason, action.groups.map(g => g.license));
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
