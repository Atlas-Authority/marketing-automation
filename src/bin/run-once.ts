import 'source-map-support/register';
import { engineConfigFromENV } from '../lib/config/env';
import { cliArgs } from '../lib/config/params';
import { dataManager } from '../lib/data/manager';
import { Engine } from "../lib/engine";
import { Hubspot } from '../lib/hubspot';
import { ConsoleLogger } from '../lib/log/console';

const dataSetId = cliArgs[0];

const console = new ConsoleLogger();

console.printInfo('Run once', `Running on [${dataSetId ?? 'latest'}] data set`);

const dataSet = (dataSetId
  ? dataManager.dataSetFrom(+dataSetId)
  : dataManager.latestDataSet());

const logDir = dataSet.logDirNamed(`once-${Date.now()}`);

const hubspot = Hubspot.memoryFromENV(console);

const engine = new Engine(hubspot, engineConfigFromENV(), console, logDir);

const data = dataSet.load();

engine.run(data);

hubspot.populateFakeIds();
logDir.hubspotOutputLogger()?.logResults(hubspot);
