import DataDir from "../data/dir";
import { ConsoleLogger } from "./console";
import { DealDataLogger } from "./deal-generator";
import { LicenseMatchLogger } from "./license-scorer";

export class Logger {

  #fast = process.argv.slice(2).includes('fast');

  #consoleLogger = new ConsoleLogger();

  #licenseScoringFile;
  #dealGeneratorFile;
  #allMatchGroupsLog;
  #checkMatchGroupsLog;

  constructor(logDir: DataDir) {
    this.#licenseScoringFile = logDir.file('license-scoring.csv');
    this.#dealGeneratorFile = logDir.file('deal-generator.txt');
    this.#allMatchGroupsLog = logDir.file('matched-groups-all.csv');
    this.#checkMatchGroupsLog = logDir.file('matched-groups-to-check.csv');
  }

  public scoreLogger() {
    if (this.#fast) return;
    return new LicenseMatchLogger(this.#licenseScoringFile.writeCsvStream());
  }

  public dealGeneratorLog() {
    return new DealDataLogger(this.#dealGeneratorFile.writeStream());

  }

  public allMatchGroupsLog() { return this.#allMatchGroupsLog.writeCsvStream() };
  public checkMatchGroupsLog() { return this.#checkMatchGroupsLog.writeCsvStream() };


  public error(prefix: string, ...args: any[]) { this.#consoleLogger.error(prefix, ...args); }
  public warn(prefix: string, ...args: any[]) { this.#consoleLogger.warn(prefix, ...args); }
  public info(prefix: string, ...args: any[]) { this.#consoleLogger.info(prefix, ...args); }

}
