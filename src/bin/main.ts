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

const log = new Logger(dataDir.subdir('out'));

const runLoopConfig = runLoopConfigFromENV();
const notifier = SlackNotifier.fromENV(log);
notifier?.notifyStarting();

run(log, runLoopConfig, {

  async work() {

    log.info('Main', 'Downloading data');
    const dataSet = new DataSet(dataDir);
    const hubspot = Hubspot.live(log);
    await downloadAllData(log, dataSet, hubspot);

    log.info('Main', 'Running engine');
    const data = dataSet.load();
    const engine = new Engine(log, hubspot, engineConfigFromENV());
    engine.run(data);

    log.info('Main', 'Upsyncing changes to HubSpot');
    await hubspot.upsyncChangesToHubspot();

    log.info('Main', 'Writing HubSpot change log file');
    log.hubspotOutputLogger().logResults(hubspot);

    log.info('Main', 'Done');
  },

  async failed(errors) {
    notifier?.notifyErrors(runLoopConfig, errors);
  },

});
