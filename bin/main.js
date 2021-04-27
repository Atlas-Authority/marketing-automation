import { readPackageUpSync } from 'read-pkg-up';
import CachedFileDownloader from "../lib/downloader/cached-file-downloader.js";
import LiveDownloader from '../lib/downloader/live-downloader.js';
import runEngine from "../lib/engine/engine.js";
import ConsoleUploader from "../lib/uploader/console-uploader.js";
import LiveUploader from "../lib/uploader/live-uploader.js";
import { ArgParser } from '../lib/util/arg-parser.js';
import config from "../lib/util/config.js";
import { AttachableError, SimpleError } from '../lib/util/errors.js';
import run from '../lib/util/runner.js';
import Slack from "../lib/util/slack.js";


const argParser = new ArgParser(process.argv.slice(2));

const downloader = argParser.getChoiceOrFail('--downloader',
  /** @type {{[key: string]: () => Downloader}} */
  ({
    'live': () => new LiveDownloader(),
    'cached': () => new CachedFileDownloader(),
  })
);

const uploader = argParser.getChoiceOrFail('--uploader',
  /** @type {{[key: string]: () => Uploader}} */
  ({
    'live': () => new LiveUploader(),
    'console-quiet': () => new ConsoleUploader({ verbose: false }),
    'console-verbose': () => new ConsoleUploader({ verbose: true }),
  })
);

config.cache.fns = argParser.get('--cached-fns')?.split(',') || [];

argParser.failIfExtraOpts();


const slack = new Slack();

const version = process.env.GITSHA || readPackageUpSync()?.packageJson.version;
await slack.postToSlack(`Starting Marketing Engine v${version}`);

run({

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
