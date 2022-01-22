import 'source-map-support/register';
import DataDir from '../lib/data/dir';
import { DataSet } from '../lib/data/set';
import Engine from "../lib/engine/engine";
import { downloadAllData } from '../lib/io/downloader';
import HubspotAPI from '../lib/io/hubspot';
import { SlackNotifier } from '../lib/io/slack-notifier';
import log from '../lib/log/logger';
import { Database } from "../lib/model/database";
import { envConfig, logLevelFromENV, runLoopConfigFromENV, serviceCredsFromENV } from "../lib/parameters/env-config";
import run from "../lib/util/runner";

main();
async function main() {

  log.setLevelFrom(logLevelFromENV());

  const dataDir = DataDir.root.subdir("in");
  const dataSet = new DataSet(dataDir);

  const creds = serviceCredsFromENV();
  const uploader = new HubspotAPI(creds.hubspotCreds);

  const notifier = SlackNotifier.fromENV();
  notifier?.notifyStarting();

  await run(runLoopConfigFromENV(), {

    async work() {
      await downloadAllData(dataSet, creds);
      const data = new DataSet(dataDir).load();
      const db = new Database(uploader, envConfig);
      await new Engine().run(data, db, null);
    },

    async failed(errors) {
      notifier?.notifyErrors(errors);
    },

  });

}
