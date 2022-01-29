import 'source-map-support/register';
import { engineConfigFromENV } from '../lib/config/env';
import { cliArgs } from '../lib/config/params';
import { dataManager } from '../lib/data/manager';
import { dataSetConfigFromENV } from '../lib/data/set';
import { Engine } from "../lib/engine";
import { ConsoleLogger } from '../lib/log/console';

const dataSetId = cliArgs[0];

const console = new ConsoleLogger();

console.printInfo('Run once', `Running on [${dataSetId ?? 'latest'}] data set`);

const { dataSet } = (dataSetId
  ? dataManager.dataSetFrom(+dataSetId, dataSetConfigFromENV())
  : dataManager.latestDataSet(dataSetConfigFromENV()));

const logDir = dataSet.makeLogDir!(`once-${Date.now()}`);

const engine = new Engine(dataSet, engineConfigFromENV(), console, logDir);

engine.run();

dataSet.hubspot.populateFakeIds();
logDir.hubspotOutputLogger()?.logResults(dataSet.hubspot);
