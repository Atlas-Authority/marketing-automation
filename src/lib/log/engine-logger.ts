import chalk from "chalk";
import log from "./logger";

export class EngineLogger {

  private count = 0;

  public step(description: string) {
    log.info('Marketing Automation', chalk.bold.blueBright(`Step ${++this.count}: ${description}`));
  }

}
