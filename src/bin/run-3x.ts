import 'source-map-support/register';
import { engineConfigFromENV } from '../lib/config/env';
import { dataManager } from '../lib/data/manager';
import { DataSet } from '../lib/data/set';
import { Engine } from "../lib/engine/engine";
import { ConsoleLogger } from '../lib/log/console';

const nextLogDirName = logDirNameGenerator();
let dataSet = dataManager.latestDataSet();

dataSet = runEngine(dataSet);
dataSet = runEngine(dataSet);
dataSet = runEngine(dataSet);

function runEngine(dataSet: DataSet) {
  const logDir = dataSet.makeLogDir!(nextLogDirName());
  const engine = new Engine(engineConfigFromENV(), new ConsoleLogger(), logDir);
  engine.run(dataSet);
  dataSet.hubspot.populateFakeIds();
  logDir.hubspotOutputLogger()?.logResults(dataSet.hubspot);
  return DataSet.fromDataSet(dataSet);
}

function logDirNameGenerator() {
  let i = 0;
  const timestamp = Date.now();
  return () => `3x-${timestamp}-${++i}`;
}
