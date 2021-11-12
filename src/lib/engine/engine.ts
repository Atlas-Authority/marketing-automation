import { EngineLogger } from '../log/engine-logger.js';
import { Database } from '../model/database.js';
import { identifyAndFlagContactTypes } from './contacts/contact-types.js';
import { ContactGenerator } from './contacts/generate-contacts.js';
import { updateContactsBasedOnMatchResults } from './contacts/update-contacts.js';
import { DealGenerator } from './deal-generator/generate-deals.js';
import { removeIgnoredApps } from './deal-generator/ignore-apps.js';
import { matchIntoLikelyGroups } from './license-matching/license-grouper.js';
import { printSummary } from './summary.js';

export default class Engine {

  async run(db: Database) {
    const log = new EngineLogger();

    log.step('Starting to download data');
    await db.downloadAllData();

    log.step('Identifying and Flagging Contact Types');
    identifyAndFlagContactTypes(db);

    log.step('Generating contacts');
    new ContactGenerator(db).run();

    log.step('Running Scoring Engine');
    let allMatches = matchIntoLikelyGroups(db);

    log.step('Updating Contacts based on Match Results');
    updateContactsBasedOnMatchResults(db, allMatches);

    log.step('Removing ignored apps from rest of engine run');
    allMatches = removeIgnoredApps(db, allMatches);

    log.step('Generating deals');
    new DealGenerator(db).run(allMatches);

    log.step('Up-syncing to Hubspot');
    await db.syncUpAllEntities();

    printSummary(db);

    log.step('Done!');
  }

}
