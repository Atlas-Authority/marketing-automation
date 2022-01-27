import 'source-map-support/register';
import { engineConfigFromENV, runLoopConfigFromENV } from "../lib/config/env";
import { dataManager } from '../lib/data/manager';
import { DataSet } from '../lib/data/set';
import { Engine } from "../lib/engine";
import { downloadAllData } from '../lib/engine/download';
import { SlackNotifier } from '../lib/engine/slack-notifier';
import { Hubspot } from '../lib/hubspot';
import { Logger } from '../lib/log';
import { ConsoleLogger } from '../lib/log/console';
import run from "../lib/util/runner";

const consoleLogger = new ConsoleLogger();

const runLoopConfig = runLoopConfigFromENV();
const notifier = SlackNotifier.fromENV(new ConsoleLogger());
notifier?.notifyStarting();

run(consoleLogger, runLoopConfig, {

  async work() {
    const dataDir = dataManager.latestDataDir();
    const log = new Logger(dataDir.subdir('main'));

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
