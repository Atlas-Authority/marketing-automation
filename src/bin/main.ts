import 'source-map-support/register';
import Engine from "../lib/engine/engine";
import { IO, LiveRemote } from '../lib/io/io';
import log from '../lib/log/logger';
import { SlackNotifier } from '../lib/log/slack-notifier';
import { Database } from "../lib/model/database";
import { getCliArgs } from '../lib/parameters/cli-args';
import { envConfig, runLoopConfigFromENV, serviceCredsFromENV } from "../lib/parameters/env-config";
import run from "../lib/util/runner";

main();
async function main() {

  const { loglevel } = getCliArgs('loglevel');
  log.setLevelFrom(loglevel);

  const io = new IO(new LiveRemote(serviceCredsFromENV()));

  const notifier = SlackNotifier.fromENV();
  notifier?.notifyStarting();

  await run(runLoopConfigFromENV(), {

    async work() {
      const db = new Database(io, envConfig);
      await new Engine().run(db, null);
    },

    async failed(errors) {
      notifier?.notifyErrors(errors);
    },

  });

}
