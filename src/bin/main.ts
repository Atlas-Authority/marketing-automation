import 'source-map-support/register';
import { engineConfigFromENV, runLoopConfigFromENV } from "../lib/config/env";
import { dataManager } from '../lib/data/manager';
import { Engine } from "../lib/engine";
import { downloadAllData } from '../lib/engine/download';
import { SlackNotifier } from '../lib/engine/slack-notifier';
import { Hubspot } from '../lib/hubspot';
import { HubspotUploader } from '../lib/hubspot/uploader';
import { ConsoleLogger } from '../lib/log/console';
import { Marketplace } from '../lib/marketplace';
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

    console.printInfo('Main', 'Downloading data');
    const hubspot = Hubspot.fromENV();
    const ms = await downloadAllData(console, hubspot);
    const { dataSet, logDir } = dataManager.dataSetFrom(ms, 'main')
    const data = dataSet.load();

    console.printInfo('Main', 'Running engine');
    const engine = new Engine(hubspot, Marketplace.fromENV(), engineConfigFromENV(), console, logDir);
    engine.run(data);

    console.printInfo('Main', 'Upsyncing changes to HubSpot');
    await uploader.upsyncChangesToHubspot(hubspot);

    console.printInfo('Main', 'Writing HubSpot change log file');
    logDir.hubspotOutputLogger()?.logResults(hubspot);

    console.printInfo('Main', 'Done');
  },

  async failed(errors) {
    notifier?.notifyErrors(runLoopConfig, errors);
  },

});
