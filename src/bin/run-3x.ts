import 'source-map-support/register';
import { engineConfigFromENV } from '../lib/config/env';
import { dataManager } from '../lib/data/manager';
import { Data, DataSet } from '../lib/data/set';
import { Engine } from "../lib/engine";
import { Hubspot } from '../lib/hubspot';
import { Console } from '../lib/log/console';

const dataDir = dataManager.latestDataDir();

let i = 0;
const timestamp = Date.now();
const nextLogDir = () => `3x-${timestamp}-${++i}`;

const dataSet = new DataSet(dataDir);
const data = dataSet.load();

let hubspot: Hubspot;
hubspot = runEngine();

pipeOutputToInput(hubspot, data);
hubspot = runEngine();

pipeOutputToInput(hubspot, data);
hubspot = runEngine();

function runEngine() {
  const logDir = dataSet.logDirNamed(nextLogDir());
  const hubspot = Hubspot.memoryFromENV(new Console());
  const engine = new Engine(hubspot, engineConfigFromENV(), new Console(), logDir);
  engine.run(data);
  hubspot.populateFakeIds();
  logDir.hubspotOutputLogger()?.logResults(hubspot);
  return hubspot;
}

function pipeOutputToInput(hubspot: Hubspot, data: Data) {
  data.rawDeals = hubspot.dealManager.getArray().map(e => e.toRawEntity());
  data.rawContacts = hubspot.contactManager.getArray().map(e => e.toRawEntity());
  data.rawCompanies = hubspot.companyManager.getArray().map(e => e.toRawEntity());
}
