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

const logDirName = `once-${Date.now()}`;
const { data, logDir, dataSet } = (dataSetId
  ? dataManager.dataSetFrom(+dataSetId, dataSetConfigFromENV(), logDirName)
  : dataManager.latestDataSet(dataSetConfigFromENV(), logDirName));

const engine = new Engine(dataSet, engineConfigFromENV(), console, logDir);

engine.run(data);

dataSet.hubspot.populateFakeIds();
logDir.hubspotOutputLogger()?.logResults(dataSet.hubspot);
