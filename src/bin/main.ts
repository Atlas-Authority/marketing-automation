import 'source-map-support/register';
import DataDir from '../lib/data/dir';
import { downloadData } from '../lib/engine/downloader';
import Engine from "../lib/engine/engine";
import { LiveRemote } from '../lib/io/io';
import log from '../lib/log/logger';
import { SlackNotifier } from '../lib/log/slack-notifier';
import { Database } from "../lib/model/database";
import { envConfig, logLevelFromENV, runLoopConfigFromENV, serviceCredsFromENV } from "../lib/parameters/env-config";
import run from "../lib/util/runner";

main();
async function main() {

  log.setLevelFrom(logLevelFromENV());

  const dataDir = DataDir.root.subdir("in");

  const remote = new LiveRemote(dataDir, serviceCredsFromENV());

  const notifier = SlackNotifier.fromENV();
  notifier?.notifyStarting();

  await run(runLoopConfigFromENV(), {

    async work() {
      const data = await downloadData(remote);
      const db = new Database(remote.hubspot, envConfig);
      await new Engine().run(data, db, null);
    },

    async failed(errors) {
      notifier?.notifyErrors(errors);
    },

  });

}
