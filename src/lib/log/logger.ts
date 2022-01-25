import DataDir from "../data/dir";
import { ConsoleLogger } from "./console";

export class Logger {

  #fast = process.argv.slice(2).includes('fast');
  #consoleLogger = new ConsoleLogger();

  constructor(logDir: DataDir) {

  }

  public error(prefix: string, ...args: any[]) { this.#consoleLogger.error(prefix, ...args); }
  public warn(prefix: string, ...args: any[]) { this.#consoleLogger.warn(prefix, ...args); }
  public info(prefix: string, ...args: any[]) { this.#consoleLogger.info(prefix, ...args); }

}
