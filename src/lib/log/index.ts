import DataDir from "../data/dir";
import { ConsoleLogger } from "./console";
import { DealDataLogger } from "./deal-generator";
import { HubspotOutputLogger } from "./hubspot-output";
import { LicenseMatchLogger } from "./license-scorer";

export class Logger {

  #fast = process.argv.slice(2).includes('fast');

  public consoleLogger = new ConsoleLogger();

  #licenseScoringFile;
  #dealGeneratorFile;
  #allMatchGroupsLog;
  #checkMatchGroupsLog;
  #hubspotResultLog;

  constructor(logDir?: DataDir) {
    this.#licenseScoringFile = this.#fast ? undefined : logDir?.file('license-scoring.csv');
    this.#dealGeneratorFile = logDir?.file('deal-generator.txt');
    this.#allMatchGroupsLog = logDir?.file('matched-groups-all.csv');
    this.#checkMatchGroupsLog = logDir?.file('matched-groups-to-check.csv');
    this.#hubspotResultLog = logDir?.file('hubspot-out.txt');
  }

  public scoreLogger() {
    if (!this.#licenseScoringFile) return;
    return new LicenseMatchLogger(this.#licenseScoringFile.writeCsvStream());
  }

  public dealGeneratorLog() {
    if (!this.#dealGeneratorFile) return;
    return new DealDataLogger(this.#dealGeneratorFile.writeStream());
  }

  public hubspotOutputLogger() {
    if (!this.#hubspotResultLog) return;
    return new HubspotOutputLogger(this.#hubspotResultLog);
  }

  public allMatchGroupsLog() { return this.#allMatchGroupsLog?.writeCsvStream() };
  public checkMatchGroupsLog() { return this.#checkMatchGroupsLog?.writeCsvStream() };

}
