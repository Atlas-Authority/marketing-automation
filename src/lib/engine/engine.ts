import chalk from "chalk";
import DataDir from "../data/dir";
import { Data } from "../io/interfaces";
import log from "../log/logger";
import { Database } from "../model/database";
import { identifyAndFlagContactTypes } from "./contacts/contact-types";
import { ContactGenerator } from "./contacts/generate-contacts";
import { updateContactsBasedOnMatchResults } from "./contacts/update-contacts";
import { DealGenerator } from "./deal-generator/generate-deals";
import { LicenseGrouper } from "./license-matching/license-grouper";
import { printSummary } from "./summary";

export default class Engine {

  private count = 0;

  public async run(data: Data, db: Database, logDir: DataDir | null) {
    this.step('Importing data into engine');
    db.importData(data);

    this.step('Identifying and Flagging Contact Types');
    identifyAndFlagContactTypes(db);

    this.step('Generating contacts');
    new ContactGenerator(db).run();

    this.step('Running Scoring Engine');
    const allMatches = new LicenseGrouper(db).run(logDir);

    this.step('Updating Contacts based on Match Results');
    updateContactsBasedOnMatchResults(db, allMatches);

    this.step('Generating deals');
    new DealGenerator(db).run(allMatches, logDir);

    this.step('Up-syncing to Hubspot');
    await db.syncUpAllEntities();

    printSummary(db);

    this.step('Done!');
  }

  private step(description: string) {
    log.info('Marketing Automation', chalk.bold.blueBright(`Step ${++this.count}: ${description}`));
  }

}
