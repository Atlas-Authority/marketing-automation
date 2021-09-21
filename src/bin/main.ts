import runEngine from "../lib/engine/engine.js";
import { getCliOptions } from "../lib/util/cli.js";
import config from "../lib/util/config/index.js";
import { AttachableError, SimpleError } from '../lib/util/errors.js';
import run from '../lib/util/runner.js';
import Slack from "../lib/services/slack.js";

const { downloader, uploader } = getCliOptions();

const slack = new Slack();

await slack.postToSlack(`Starting Marketing Engine`);

await run({

  async work() {
    await runEngine({
      downloader,
      uploader,
    });
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
