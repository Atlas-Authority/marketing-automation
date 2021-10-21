import * as assert from 'assert';
import _ from 'lodash';
import { saveForInspection } from '../cache/inspection.js';
import log from '../log/logger.js';
import { Database } from '../model/database.js';
import { License, LicenseData } from '../model/marketplace/license.js';
import { isPresent, sorter } from '../util/helpers.js';
import { ActionGenerator, CreateDealAction, UpdateDealAction } from './deal-generator/actions.js';
import { DealFinder } from './deal-generator/deal-finder.js';
import { EventGenerator } from './deal-generator/events.js';
import { getEmails } from './deal-generator/records.js';
import { RelatedLicenseSet } from './license-grouper.js';

export function generateDeals(db: Database, allMatches: RelatedLicenseSet[]) {
  const matches = allMatches
    .filter(group =>
      group.some(m =>
        !olderThan90Days(m.license.data.maintenanceStartDate)));

  const generator = new DealActionGenerator(db);

  // Stages:
  // 1. Sort and normalize licenses/transactions (event records)
  // 2. Turn event records into deal-generating-relevant events
  // 3. Match events up with deal state and generate actions

  for (const relatedLicenseIds of matches) {
    generator.generateActionsForMatchedGroup(relatedLicenseIds);
  }

  saveForInspection('ignored', generator.ignoredLicenseSets);

  const dealCreateActions = generator.dealCreateActions;
  const dealUpdateActions = generator.dealUpdateActions;

  for (const { groups, properties } of dealCreateActions) {
    const deal = db.dealManager.create(properties);

    const contacts = contactsFor(db, groups);
    const companies = (contacts
      .filter(c => c.isCustomer)
      .flatMap(c => c.companies.getAll()));

    for (const contact of contacts) {
      deal.contacts.add(contact);
    }

    for (const company of companies) {
      deal.companies.add(company);
    }
  }

  for (const { deal, groups, properties } of dealUpdateActions) {
    const contacts = contactsFor(db, groups);
    const companies = (contacts
      .filter(c => c.isCustomer)
      .flatMap(c => c.companies.getAll()));

    deal.contacts.clear();
    for (const contact of contacts) {
      deal.contacts.add(contact);
    }

    deal.companies.clear();
    for (const company of companies) {
      deal.companies.add(company);
    }

    for (const [k, v] of Object.entries(properties)) {
      deal.data[k] = v;
    }
  }
}

/** Generates deal actions based on match data */
class DealActionGenerator {

  actionGenerator: ActionGenerator;
  dealFinder: DealFinder;

  dealCreateActions: CreateDealAction[] = [];
  dealUpdateActions: UpdateDealAction[] = [];

  ignoredLicenseSets: (LicenseData & { reason: string })[][] = [];

  constructor(private db: Database) {
    this.dealFinder = new DealFinder(db.dealManager.getAll());
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
    const domains = licenses.map(license => license.data.technicalContact.email.toLowerCase().split('@')[1]);
    const badDomains = domains.filter(domain => this.db.partnerDomains.has(domain) || this.db.providerDomains.has(domain));

    if (badDomains.length === licenses.length) {
      this.ignoreLicenses('bad-domains:' + _.uniq(badDomains).join(','), licenses);
      return true;
    }

    return false;
  }

  ignoreLicenses(reason: string, licenses: License[]) {
    this.ignoredLicenseSets.push(licenses.map(license => ({ reason, ...license.data })));
  }

}

const NINETY_DAYS_AS_MS = (1000 * 60 * 60 * 24 * 90);

export function olderThan90Days(dateString: string) {
  const now = Date.now();
  const then = new Date(dateString).getTime();
  return (now - then > NINETY_DAYS_AS_MS);
}

function contactsFor(db: Database, groups: RelatedLicenseSet) {
  return (_.uniq(
    groups
      .flatMap(group => [group.license, ...group.transactions])
      .flatMap(getEmails)
  )
    .map(email => db.contactManager.getByEmail(email))
    .filter(isPresent))
    .sort(sorter(c => c.isCustomer ? -1 : 0));
}
