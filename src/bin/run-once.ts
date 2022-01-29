import 'source-map-support/register';
import { engineConfigFromENV } from '../lib/config/env';
import { cliArgs } from '../lib/config/params';
import { DataSet, dataSetConfigFromENV } from '../lib/data/data';
import { dataManager } from '../lib/data/manager';
import { Engine } from "../lib/engine";
import { ConsoleLogger } from '../lib/log/console';

const dataSetId = cliArgs[0];

const console = new ConsoleLogger();

console.printInfo('Run once', `Running on [${dataSetId ?? 'latest'}] data set`);

const logDirName = `once-${Date.now()}`;
const { data, logDir } = (dataSetId
  ? dataManager.dataSetFrom(+dataSetId, logDirName)
  : dataManager.latestDataSet(logDirName));

const dataSet = new DataSet(dataSetConfigFromENV());

const engine = new Engine(dataSet, engineConfigFromENV(), console, logDir);

engine.run(data);

dataSet.hubspot.populateFakeIds();
logDir.hubspotOutputLogger()?.logResults(dataSet.hubspot);
