import chalk from "chalk";
import log from "./logger.js";

export class EngineLogger {

  count = 0;

  step(description: string) {
    log.info('Marketing Automation', chalk.bold.blueBright(`Step ${++this.count}: ${description}`));
  }

}
