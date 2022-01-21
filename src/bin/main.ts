import 'source-map-support/register';
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

  const out = new LiveRemote(serviceCredsFromENV());

  const notifier = SlackNotifier.fromENV();
  notifier?.notifyStarting();

  await run(runLoopConfigFromENV(), {

    async work() {
      const db = new Database(out, envConfig);
      await new Engine().run(new LiveRemote(serviceCredsFromENV()), db, null);
    },

    async failed(errors) {
      notifier?.notifyErrors(errors);
    },

  });

}
