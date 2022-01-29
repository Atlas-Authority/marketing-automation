import 'source-map-support/register';
import { engineConfigFromENV, runLoopConfigFromENV } from "../lib/config/env";
import { DataSet, dataSetConfigFromENV } from '../lib/data/data';
import { dataManager } from '../lib/data/manager';
import { Engine } from "../lib/engine";
import { downloadAllData } from '../lib/engine/download';
import { SlackNotifier } from '../lib/engine/slack-notifier';
import { HubspotUploader } from '../lib/hubspot/uploader';
import { ConsoleLogger } from '../lib/log/console';
import run from "../lib/util/runner";

const console = new ConsoleLogger();
const uploader = new HubspotUploader(console);

const runLoopConfig = runLoopConfigFromENV();
const notifier = SlackNotifier.fromENV(new ConsoleLogger());
notifier?.notifyStarting();

run(console, runLoopConfig, {

  async work() {
    console.printInfo('Main', 'Pruning data sets');
    dataManager.pruneDataSets(console);

    const dataSet = new DataSet(dataSetConfigFromENV());

    console.printInfo('Main', 'Downloading data');
    const ms = await downloadAllData(console, dataSet.hubspot);
    const { data, logDir } = dataManager.dataSetFrom(ms, 'main');

    console.printInfo('Main', 'Running engine');
    const engine = new Engine(dataSet, engineConfigFromENV(), console, logDir);
    engine.run(data);

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
