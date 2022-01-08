import { EngineLogger } from "../log/engine-logger";
import { Database } from "../model/database";
import { identifyAndFlagContactTypes } from "./contacts/contact-types";
import { ContactGenerator } from "./contacts/generate-contacts";
import { updateContactsBasedOnMatchResults } from "./contacts/update-contacts";
import { DealGenerator } from "./deal-generator/generate-deals";
import { LicenseGrouper } from "./license-matching/license-grouper";
import { printSummary } from "./summary";

export default class Engine {

  public async run(db: Database) {
    const log = new EngineLogger();

    log.step('Starting to download data');
    await db.downloadAllData();

    log.step('Identifying and Flagging Contact Types');
    identifyAndFlagContactTypes(db);

    log.step('Generating contacts');
    new ContactGenerator(db).run();

    log.step('Running Scoring Engine');
    const allMatches = new LicenseGrouper(db).run();

    log.step('Updating Contacts based on Match Results');
    updateContactsBasedOnMatchResults(db, allMatches);

    log.step('Generating deals');
    new DealGenerator(db).run(allMatches);

    log.step('Up-syncing to Hubspot');
    await db.syncUpAllEntities();

    printSummary(db);

    log.step('Done!');
  }

}
