import 'source-map-support/register';
import { engineConfigFromENV } from '../lib/config/env';
import { dataManager } from '../lib/data/manager';
import { RawDataSet } from '../lib/data/raw';
import { DataSet, dataSetConfigFromENV } from '../lib/data/set';
import { Engine } from "../lib/engine";
import { Hubspot } from '../lib/hubspot';
import { ConsoleLogger } from '../lib/log/console';

const nextLogDirName = logDirNameGenerator();
const { data } = dataManager.latestDataSet();

let hubspot: Hubspot;
hubspot = runEngine();

pipeOutputToInput(hubspot, data);
hubspot = runEngine();

pipeOutputToInput(hubspot, data);
hubspot = runEngine();

function runEngine() {
  const { logDir } = dataManager.latestDataSet(nextLogDirName());
  const dataSet = new DataSet(dataSetConfigFromENV());
  const engine = new Engine(dataSet, engineConfigFromENV(), new ConsoleLogger(), logDir);
  engine.run(data);
  dataSet.hubspot.populateFakeIds();
  logDir.hubspotOutputLogger()?.logResults(dataSet.hubspot);
  return dataSet.hubspot;
}

function pipeOutputToInput(hubspot: Hubspot, data: RawDataSet) {
  data.rawDeals = hubspot.dealManager.getArray().map(e => e.toRawEntity());
  data.rawContacts = hubspot.contactManager.getArray().map(e => e.toRawEntity());
  data.rawCompanies = hubspot.companyManager.getArray().map(e => e.toRawEntity());
}

function logDirNameGenerator() {
  let i = 0;
  const timestamp = Date.now();
  return () => `3x-${timestamp}-${++i}`;
}
