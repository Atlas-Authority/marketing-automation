import Engine from "../lib/engine/engine.js";
import { IO } from "../lib/io/io.js";
import Slack from "../lib/io/slack.js";
import { Database } from "../lib/model/database.js";
import { cli } from "../lib/parameters/cli.js";
import env from "../lib/parameters/env.js";
import { AttachableError, KnownError } from '../lib/util/errors.js';
import run from '../lib/util/runner.js';

const io = IO.fromCli();
cli.failIfExtraOpts();

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
      if (error instanceof KnownError) {
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
