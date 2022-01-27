import 'source-map-support/register';
import { engineConfigFromENV } from '../lib/config/env';
import DataDir from '../lib/data/dir';
import { Data, DataSet } from '../lib/data/set';
import { Engine } from "../lib/engine/engine";
import { Hubspot } from '../lib/hubspot';
import { Logger } from '../lib/log';

const dataDir = DataDir.root.subdir('in');

let i = 0;
const timestamp = Date.now();
const nextLogDir = () => dataDir.subdir(`3x-${timestamp}-${++i}`);

const data = new DataSet(dataDir).load();

let hubspot: Hubspot;
hubspot = runEngine();

pipeOutputToInput(hubspot, data);
hubspot = runEngine();

pipeOutputToInput(hubspot, data);
hubspot = runEngine();

function runEngine() {
  const log = new Logger(nextLogDir());
  const hubspot = Hubspot.memoryFromENV(log.consoleLogger);
  const engine = new Engine(hubspot, engineConfigFromENV(), log);
  engine.run(data);
  hubspot.populateFakeIds();
  log.hubspotOutputLogger()?.logResults(hubspot);
  return hubspot;
}

function pipeOutputToInput(hubspot: Hubspot, data: Data) {
  data.rawDeals = hubspot.dealManager.getArray().map(e => e.toRawEntity());
  data.rawContacts = hubspot.contactManager.getArray().map(e => e.toRawEntity());
  data.rawCompanies = hubspot.companyManager.getArray().map(e => e.toRawEntity());
}
