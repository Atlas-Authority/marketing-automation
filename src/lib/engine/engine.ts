import { EngineLogger } from '../log/engine-logger.js';
import { Database } from '../model/database.js';
import { identifyAndFlagContactTypes } from './contacts/contact-types.js';
import { ContactGenerator } from './contacts/generate-contacts.js';
import { updateContactsBasedOnMatchResults } from './contacts/update-contacts.js';
import { DealGenerator } from './deal-generator/generate-deals.js';
import { removeIgnoredApps } from './deal-generator/ignored-apps.js';
import { matchIntoLikelyGroups } from './license-matching/license-grouper.js';
import { printSummary } from './summary.js';

export default class Engine {

  async run(db: Database) {
    const log = new EngineLogger();

    log.step('Starting to download data');
    await db.downloadAllData();

    log.step('Identifying and Flagging Contact Types');
    identifyAndFlagContactTypes(db);

    log.step('Updating Contacts/Companies in Hubspot');
    await db.syncUpAllEntities();

    log.step('Removing externally created contacts from rest of engine run');
    db.contactManager.removeExternallyCreatedContacts();

    log.step('Generating contacts');
    new ContactGenerator(db).run();

    log.step('Upserting Generated Contacts in Hubspot');
    await db.syncUpAllEntities();

    log.step('Removing ignored apps from rest of engine run');
    removeIgnoredApps(db);

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

}
