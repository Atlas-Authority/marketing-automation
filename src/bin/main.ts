import 'source-map-support/register';
import { engineConfigFromENV, runLoopConfigFromENV } from "../lib/config/env";
import { dataManager } from '../lib/data/manager';
import { Engine } from "../lib/engine";
import { downloadAllData } from '../lib/engine/download';
import { SlackNotifier } from '../lib/engine/slack-notifier';
import { Hubspot } from '../lib/hubspot';
import { Console } from '../lib/log/console';
import run from "../lib/util/runner";

const console = new Console();

const runLoopConfig = runLoopConfigFromENV();
const notifier = SlackNotifier.fromENV(new Console());
notifier?.notifyStarting();

run(console, runLoopConfig, {

  async work() {
    const dataSet = dataManager.latestDataSet();
    const logDir = dataSet.logDirNamed('main');

    console.printInfo('Main', 'Downloading data');
    const hubspot = Hubspot.live(console);
    await downloadAllData(console, dataSet, hubspot);

    console.printInfo('Main', 'Running engine');
    const data = dataSet.load();
    const engine = new Engine(hubspot, engineConfigFromENV(), console, logDir);
    engine.run(data);

    console.printInfo('Main', 'Upsyncing changes to HubSpot');
    await hubspot.upsyncChangesToHubspot();

    console.printInfo('Main', 'Writing HubSpot change log file');
    logDir.hubspotOutputLogger()?.logResults(hubspot);

    console.printInfo('Main', 'Done');
  },

  async failed(errors) {
    notifier?.notifyErrors(runLoopConfig, errors);
  },

});
