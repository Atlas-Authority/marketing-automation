import 'source-map-support/register';
import { engineConfigFromENV } from '../lib/config/env';
import { dataManager } from '../lib/data/manager';
import { Data, DataSet } from '../lib/data/set';
import { Engine } from "../lib/engine";
import { Hubspot } from '../lib/hubspot';
import { Logger } from '../lib/log';
import { ConsoleLogger } from '../lib/log/console';

const dataDir = dataManager.latestDataDir();

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
  const hubspot = Hubspot.memoryFromENV(new ConsoleLogger());
  const engine = new Engine(hubspot, engineConfigFromENV(), new ConsoleLogger(), log);
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
