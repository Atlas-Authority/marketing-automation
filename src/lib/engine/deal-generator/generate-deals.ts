import * as assert from 'assert';
import { saveForInspection } from '../../cache/inspection.js';
import log from '../../log/logger.js';
import { Database } from '../../model/database.js';
import { Deal } from '../../model/deal.js';
import { License, LicenseData } from '../../model/license.js';
import { isPresent, sorter, uniqueArray } from '../../util/helpers.js';
import { RelatedLicenseSet } from '../license-matching/license-grouper.js';
import { ActionGenerator, CreateDealAction, UpdateDealAction } from './actions.js';
import { EventGenerator } from './events.js';
import { getEmails } from './records.js';

/** Generates deal actions based on match data */
export class DealGenerator {

  private actionGenerator: ActionGenerator;

  private dealCreateActions: CreateDealAction[] = [];
  private dealUpdateActions: UpdateDealAction[] = [];

  private ignoredLicenseSets: (LicenseData & { reason: string })[][] = [];

  constructor(private db: Database) {
    this.actionGenerator = new ActionGenerator(db.dealManager);
  }

  run(matches: RelatedLicenseSet[]) {
    for (const relatedLicenseIds of matches) {
      this.generateActionsForMatchedGroup(relatedLicenseIds);
    }

    saveForInspection('ignored', this.ignoredLicenseSets);

    for (const { groups, properties } of this.dealCreateActions) {
      const deal = this.db.dealManager.create(properties);
      this.associateDealContactsAndCompanies(groups, deal);
    }

    for (const { deal, groups } of this.dealUpdateActions) {
      this.associateDealContactsAndCompanies(groups, deal);
    }

    if (this.actionGenerator.duplicatesToDelete.size > 0) {
      log.warn('Deal Generator', 'Found duplicate deals; delete them manually', this.actionGenerator.duplicatesToDelete);
    }
  }

  private generateActionsForMatchedGroup(groups: RelatedLicenseSet) {
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

  private associateDealContactsAndCompanies(groups: RelatedLicenseSet, deal: Deal) {
    const contacts = contactsFor(this.db, groups);
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
  }

  /** Ignore if every license's tech contact domain is partner or mass-provider */
  private ignoring(groups: RelatedLicenseSet) {
    const licenses = groups.map(g => g.license);
    const domains = licenses.map(license => license.data.technicalContact.email.toLowerCase().split('@')[1]);
    const badDomains = domains.filter(domain => this.db.partnerDomains.has(domain) || this.db.providerDomains.has(domain));

    if (badDomains.length === licenses.length) {
      this.ignoreLicenses('bad-domains:' + uniqueArray(badDomains).join(','), licenses);
      return true;
    }

    return false;
  }

  private ignoreLicenses(reason: string, licenses: License[]) {
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
  return (uniqueArray(
    groups
      .flatMap(group => [group.license, ...group.transactions])
      .flatMap(getEmails)
  )
    .map(email => db.contactManager.getByEmail(email))
    .filter(isPresent))
    .sort(sorter(c => c.isCustomer ? -1 : 0));
}
