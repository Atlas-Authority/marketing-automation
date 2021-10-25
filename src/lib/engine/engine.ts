import { EngineLogger } from '../log/engine-logger.js';
import { Database } from '../model/database.js';
import { findAndFlagExternallyCreatedContacts, findAndFlagPartnerCompanies, findAndFlagPartnersByDomain, identifyDomains } from './contacts/contact-types.js';
import { ContactGenerator } from './contacts/generate-contacts.js';
import { updateContactsBasedOnMatchResults } from './contacts/update-contacts.js';
import { DealGenerator } from './deal-generator/generate-deals.js';
import { matchIntoLikelyGroups } from './license-matching/license-grouper.js';
import { printSummary } from './summary.js';

export default async function runEngine(db: Database) {
  const log = new EngineLogger();

  log.step('Starting to download data');
  await db.downloadAllData();

  log.step('Identifying partner and customer domains');
  identifyDomains(db);

  log.step('Flagging partner/customer contacts created outside engine');
  findAndFlagExternallyCreatedContacts(db);
  await db.syncUpAllEntities();

  log.step('Generating contacts');
  new ContactGenerator(db).run();

  log.step('Removing externally created contacts from rest of engine run');
  db.contactManager.removeExternallyCreatedContacts();

  log.step('Flagging partner companies');
  findAndFlagPartnerCompanies(db);

  log.step('Flagging partners by domain');
  findAndFlagPartnersByDomain(db);

  log.step('Upserting Contacts/Companies in Hubspot');
  await db.syncUpAllEntities();

  log.step('Running Scoring Engine');
  const allMatches = matchIntoLikelyGroups(db);

  log.step('Updating Contacts based on Match Results');
  updateContactsBasedOnMatchResults(db, allMatches);
  await db.syncUpAllEntities();

  log.step('Generating deals');
  new DealGenerator(db).run(allMatches);

  log.step('Upserting deals in Hubspot');
  await db.syncUpAllEntities();

  printSummary(db);

  log.step('Done!');
}
