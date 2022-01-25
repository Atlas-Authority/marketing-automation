import 'source-map-support/register';
import DataDir from '../lib/data/dir';
import { DataSet } from '../lib/data/set';
import { downloadAllData } from '../lib/engine/download';
import { Engine } from "../lib/engine/engine";
import { SlackNotifier } from '../lib/engine/slack-notifier';
import { Hubspot } from '../lib/hubspot';
import { Logger } from '../lib/log';
import { engineConfigFromENV, runLoopConfigFromENV } from "../lib/parameters/env-config";
import run from "../lib/util/runner";

const dataDir = DataDir.root.subdir("in");

const log = new Logger(dataDir.subdir('main'));

const runLoopConfig = runLoopConfigFromENV();
const notifier = SlackNotifier.fromENV(log);
notifier?.notifyStarting();

run(log, runLoopConfig, {

  async work() {

    log.printInfo('Main', 'Downloading data');
    const dataSet = new DataSet(dataDir);
    const hubspot = Hubspot.live(log);
    await downloadAllData(log, dataSet, hubspot);

    log.printInfo('Main', 'Running engine');
    const data = dataSet.load();
    const engine = new Engine(hubspot, engineConfigFromENV(), log);
    engine.run(data);

    log.printInfo('Main', 'Upsyncing changes to HubSpot');
    await hubspot.upsyncChangesToHubspot();

    log.printInfo('Main', 'Writing HubSpot change log file');
    log.hubspotOutputLogger().logResults(hubspot);

    log.printInfo('Main', 'Done');
  },

  async failed(errors) {
    notifier?.notifyErrors(runLoopConfig, errors);
  },

});
