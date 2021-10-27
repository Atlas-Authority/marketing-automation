import { EngineLogger } from '../log/engine-logger.js';
import { Database } from '../model/database.js';
import { findAndFlagExternallyCreatedContacts, findAndFlagPartnerCompanies, findAndFlagPartnersByDomain, identifyDomains } from './contacts/contact-types.js';
import { ContactGenerator } from './contacts/generate-contacts.js';
import { updateContactsBasedOnMatchResults } from './contacts/update-contacts.js';
import { DealGenerator } from './deal-generator/generate-deals.js';
import { matchIntoLikelyGroups } from './license-matching/license-grouper.js';
import { printSummary } from './summary.js';

export default class Engine {

  log = new EngineLogger();
  constructor(private db: Database) { }

  async run() {
    this.log.step('Starting to download data');
    await this.db.downloadAllData();

    this.log.step('Identifying partner and customer domains');
    identifyDomains(this.db);

    this.log.step('Flagging partner/customer contacts created outside engine');
    findAndFlagExternallyCreatedContacts(this.db);
    await this.db.syncUpAllEntities();

    this.log.step('Generating contacts');
    new ContactGenerator(this.db).run();

    this.log.step('Removing externally created contacts from rest of engine run');
    this.db.contactManager.removeExternallyCreatedContacts();

    this.log.step('Flagging partner companies');
    findAndFlagPartnerCompanies(this.db);

    this.log.step('Flagging partners by domain');
    findAndFlagPartnersByDomain(this.db);

    this.log.step('Upserting Contacts/Companies in Hubspot');
    await this.db.syncUpAllEntities();

    this.log.step('Running Scoring Engine');
    const allMatches = matchIntoLikelyGroups(this.db);

    this.log.step('Updating Contacts based on Match Results');
    updateContactsBasedOnMatchResults(this.db, allMatches);
    await this.db.syncUpAllEntities();

    this.log.step('Generating deals');
    new DealGenerator(this.db).run(allMatches);

    this.log.step('Upserting deals in Hubspot');
    await this.db.syncUpAllEntities();

    printSummary(this.db);

    this.log.step('Done!');
  }

}
