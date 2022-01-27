import 'source-map-support/register';
import { engineConfigFromENV, runLoopConfigFromENV } from "../lib/config/env";
import DataDir from '../lib/data/dir';
import { DataSet } from '../lib/data/set';
import { downloadAllData } from '../lib/engine/download';
import { Engine } from "../lib/engine";
import { SlackNotifier } from '../lib/engine/slack-notifier';
import { Hubspot } from '../lib/hubspot';
import { Logger } from '../lib/log';
import { ConsoleLogger } from '../lib/log/console';
import run from "../lib/util/runner";

const dataDir = DataDir.root.subdir("in");

const log = new Logger(dataDir.subdir('main'));

const consoleLogger = log.consoleLogger;

const runLoopConfig = runLoopConfigFromENV();
const notifier = SlackNotifier.fromENV(new ConsoleLogger());
notifier?.notifyStarting();

run(consoleLogger, runLoopConfig, {

  async work() {

    consoleLogger.printInfo('Main', 'Downloading data');
    const dataSet = new DataSet(dataDir);
    const hubspot = Hubspot.live(consoleLogger);
    await downloadAllData(consoleLogger, dataSet, hubspot);

    consoleLogger.printInfo('Main', 'Running engine');
    const data = dataSet.load();
    const engine = new Engine(hubspot, engineConfigFromENV(), log);
    engine.run(data);

    consoleLogger.printInfo('Main', 'Upsyncing changes to HubSpot');
    await hubspot.upsyncChangesToHubspot();

    consoleLogger.printInfo('Main', 'Writing HubSpot change log file');
    log.hubspotOutputLogger()?.logResults(hubspot);

    consoleLogger.printInfo('Main', 'Done');
  },

  async failed(errors) {
    notifier?.notifyErrors(runLoopConfig, errors);
  },

});
