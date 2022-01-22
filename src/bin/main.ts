import 'source-map-support/register';
import DataDir from '../lib/data/dir';
import { DataSet } from '../lib/data/set';
import { downloadAllData } from '../lib/engine/download';
import { Engine } from "../lib/engine/engine";
import { SlackNotifier } from '../lib/engine/slack-notifier';
import { HubspotService } from '../lib/hubspot/service';
import log from '../lib/log/logger';
import { getCliArgs } from '../lib/parameters/cli-args';
import { engineConfigFromENV, runLoopConfigFromENV } from "../lib/parameters/env-config";
import run from "../lib/util/runner";

main();
async function main() {

  const { loglevel } = getCliArgs('loglevel');
  log.setLevelFrom(loglevel);

  const dataDir = DataDir.root.subdir("in");
  const dataSet = new DataSet(dataDir);

  const runLoopConfig = runLoopConfigFromENV();
  const notifier = SlackNotifier.fromENV();
  notifier?.notifyStarting();

  await run(runLoopConfig, {

    async work() {
      const hubspot = HubspotService.live();
      await downloadAllData(dataSet, hubspot);
      const data = new DataSet(dataDir).load();
      const engine = new Engine(hubspot, engineConfigFromENV());
      await engine.run(data, null);
    },

    async failed(errors) {
      notifier?.notifyErrors(runLoopConfig, errors);
    },

  });

}
