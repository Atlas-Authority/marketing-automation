import Engine from "../lib/engine/engine.js";
import { getIoFromCli } from "../lib/io/io.js";
import { Database } from "../lib/model/database.js";
import { cliParams } from "../lib/parameters/cli.js";
import env from "../lib/parameters/env.js";
import Slack from "../lib/services/slack.js";
import { AttachableError, SimpleError } from '../lib/util/errors.js';
import run from '../lib/util/runner.js';

const io = getIoFromCli();
cliParams.failIfExtraOpts();

const slack = new Slack();

await slack.postToSlack(`Starting Marketing Engine`);

await run({

  async work() {
    const db = new Database(io);
    await new Engine().run(db);
  },

  async failed(errors) {
    await slack.postToSlack(`Failed ${env.engine.retryTimes} times. Below are the specific errors, in order. Trying again in ${env.engine.runInterval}.`);
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
