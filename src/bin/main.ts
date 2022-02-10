import 'source-map-support/register';
import { engineConfigFromENV, runLoopConfigFromENV } from "../lib/config/env";
import { dataManager } from '../lib/data/manager';
import { downloadAllData } from '../lib/engine/download';
import { Engine } from "../lib/engine/engine";
import { SlackNotifier } from '../lib/engine/slack-notifier';
import { hubspotConfigFromENV } from '../lib/hubspot/hubspot';
import { HubspotUploader } from '../lib/hubspot/uploader';
import { ConsoleLogger } from '../lib/log/console';
import run from "../lib/util/runner";

const console = new ConsoleLogger();
const uploader = new HubspotUploader(console);

const runLoopConfig = runLoopConfigFromENV();
const notifier = SlackNotifier.fromENV(console);
notifier?.notifyStarting();

run(console, runLoopConfig, {

  async work() {
    console.printInfo('Main', 'Pruning data sets');
    dataManager.pruneDataSets(console);

    console.printInfo('Main', 'Downloading data');
    const ms = await downloadAllData(console, hubspotConfigFromENV());
    const dataSet = dataManager.dataSetFrom(ms);
    const logDir = dataSet.makeLogDir!('main');

    console.printInfo('Main', 'Running engine');
    const engine = new Engine(engineConfigFromENV(), console, logDir);
    engine.run(dataSet);

    console.printInfo('Main', 'Upsyncing changes to HubSpot');
    await uploader.upsyncChangesToHubspot(dataSet.hubspot);

    console.printInfo('Main', 'Writing HubSpot change log file');
    logDir.hubspotOutputLogger()?.logResults(dataSet.hubspot);

    console.printInfo('Main', 'Done');
  },

  async failed(errors) {
    notifier?.notifyErrors(runLoopConfig, errors);
  },

});
