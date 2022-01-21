import DataDir from "../data/dir";
import { Remote } from "../io/interfaces";
import { EngineLogger } from "../log/engine-logger";
import { Database } from "../model/database";
import { identifyAndFlagContactTypes } from "./contacts/contact-types";
import { ContactGenerator } from "./contacts/generate-contacts";
import { updateContactsBasedOnMatchResults } from "./contacts/update-contacts";
import { DealGenerator } from "./deal-generator/generate-deals";
import { downloadData } from "./downloader";
import { LicenseGrouper } from "./license-matching/license-grouper";
import { printSummary } from "./summary";

export default class Engine {

  public async run(inRemote: Remote, db: Database, logDir: DataDir | null) {
    const log = new EngineLogger();

    log.step('Starting to download data');
    const data = await downloadData(inRemote);
    db.importData(data);

    log.step('Identifying and Flagging Contact Types');
    identifyAndFlagContactTypes(db);

    log.step('Generating contacts');
    new ContactGenerator(db).run();

    log.step('Running Scoring Engine');
    const allMatches = new LicenseGrouper(db).run(logDir);

    log.step('Updating Contacts based on Match Results');
    updateContactsBasedOnMatchResults(db, allMatches);

    log.step('Generating deals');
    new DealGenerator(db).run(allMatches, logDir);

    log.step('Up-syncing to Hubspot');
    await db.syncUpAllEntities();

    printSummary(db);

    log.step('Done!');
  }

}
