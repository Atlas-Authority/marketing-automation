import 'source-map-support/register';
import DataDir from '../lib/data/dir';
import { DataSet } from '../lib/data/set';
import { downloadAllData } from '../lib/engine/downloader';
import { Engine } from "../lib/engine/engine";
import { SlackNotifier } from '../lib/engine/slack-notifier';
import HubspotAPI from '../lib/hubspot/api';
import log from '../lib/log/logger';
import { engineConfigFromENV, logLevelFromENV, runLoopConfigFromENV, serviceCredsFromENV } from "../lib/parameters/env-config";
import run from "../lib/util/runner";

main();
async function main() {

  log.setLevelFrom(logLevelFromENV());

  const dataDir = DataDir.root.subdir("in");
  const dataSet = new DataSet(dataDir);

  const creds = serviceCredsFromENV();
  const uploader = new HubspotAPI(creds.hubspotCreds);

  const runLoopConfig = runLoopConfigFromENV();
  const notifier = SlackNotifier.fromENV();
  notifier?.notifyStarting();

  await run(runLoopConfig, {

    async work() {
      await downloadAllData(dataSet, creds);
      const data = new DataSet(dataDir).load();
      const engine = new Engine(uploader, engineConfigFromENV());
      await engine.run(data, null);
    },

    async failed(errors) {
      notifier?.notifyErrors(runLoopConfig, errors);
    },

  });

}
