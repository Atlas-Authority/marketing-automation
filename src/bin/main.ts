import 'source-map-support/register';
import { dataShiftConfigFromENV, engineConfigFromENV, runLoopConfigFromENV } from "../lib/config/env";
import { DataShiftAnalyzer } from '../lib/data-shift/analyze';
import { loadDataSets } from '../lib/data-shift/loader';
import { DataShiftReporter } from '../lib/data-shift/reporter';
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
void notifier?.notifyStarting();

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

    console.printInfo('Main', 'Analyzing data shift');
    const dataSets = loadDataSets(console);
    const analyzer = new DataShiftAnalyzer(dataShiftConfigFromENV(), console);
    const results = analyzer.run(dataSets);
    const reporter = new DataShiftReporter(console, notifier);
    reporter.report(results);

    console.printInfo('Main', 'Done');
  },

  async failed(errors) {
    await notifier?.notifyErrors(runLoopConfig, errors);
  },

});
