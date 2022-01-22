import 'source-map-support/register';
import DataDir from '../lib/data/dir';
import Engine from "../lib/engine/engine";
import { Downloader, loadDataFromDisk } from '../lib/io/downloader';
import HubspotAPI from '../lib/io/live/hubspot';
import log from '../lib/log/logger';
import { SlackNotifier } from '../lib/log/slack-notifier';
import { Database } from "../lib/model/database";
import { envConfig, logLevelFromENV, runLoopConfigFromENV, serviceCredsFromENV } from "../lib/parameters/env-config";
import run from "../lib/util/runner";

main();
async function main() {

  log.setLevelFrom(logLevelFromENV());

  const dataDir = DataDir.root.subdir("in");

  const creds = serviceCredsFromENV();
  const downloader = new Downloader(dataDir, creds);
  const uploader = new HubspotAPI(dataDir, creds.hubspotCreds);

  const notifier = SlackNotifier.fromENV();
  notifier?.notifyStarting();

  await run(runLoopConfigFromENV(), {

    async work() {
      await downloader.downloadData();
      const data = loadDataFromDisk(dataDir);
      const db = new Database(uploader, envConfig);
      await new Engine().run(data, db, null);
    },

    async failed(errors) {
      notifier?.notifyErrors(errors);
    },

  });

}
