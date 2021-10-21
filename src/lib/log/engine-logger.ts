import log from "./logger.js";

const PREFIX = '\x1b[36m'; // light blue
const RESET = '\x1b[0m';

export class EngineLogger {

  count = 0;

  step(description: string) {
    log.info('Marketing Automation', `${PREFIX}Step ${++this.count}: ${description}${RESET}`);
  }

}
