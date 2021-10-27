import { sharedArgParser } from "../lib/cli/arg-parser.js";
import { getIoFromCli } from "../lib/cli/index.js";
import config from "../lib/config/index.js";
import Engine from "../lib/engine/engine.js";
import { Database } from "../lib/model/database.js";
import Slack from "../lib/services/slack.js";
import { AttachableError, SimpleError } from '../lib/util/errors.js';
import run from '../lib/util/runner.js';

const { downloader, uploader } = getIoFromCli();
sharedArgParser.failIfExtraOpts();

const db = new Database(downloader, uploader);

const slack = new Slack();

await slack.postToSlack(`Starting Marketing Engine`);

await run({

  async work() {
    await new Engine().run(db);
  },

  async failed(errors) {
    await slack.postToSlack(`Failed ${config.engine.retryTimes} times. Below are the specific errors, in order. Trying again in ${config.engine.runInterval}.`);
    for (const error of errors) {
      if (error instanceof SimpleError) {
        await slack.postErrorToSlack(error.message);
      }
      else if (error instanceof AttachableError) {
        await slack.postErrorToSlack(`\`\`\`\n${error.stack}\n\`\`\``);
        await slack.postAttachmentToSlack({
          title: 'Error attachment for ^',
          content: error.attachment,
        });
      }
      else {
        await slack.postErrorToSlack(`\`\`\`\n${error.stack}\n\`\`\``);
      }
    }
  },

});
