import 'source-map-support/register';
import { engineConfigFromENV } from '../lib/config/env';
import { dataManager } from '../lib/data/manager';
import { DataSet } from '../lib/data/set';
import { Engine } from "../lib/engine";
import { Hubspot } from '../lib/hubspot';
import { ConsoleLogger } from '../lib/log/console';
import { Marketplace } from '../lib/marketplace';

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
  const hubspot = Hubspot.fromENV();
  const engine = new Engine(hubspot, Marketplace.fromENV(), engineConfigFromENV(), new ConsoleLogger(), logDir);
  engine.run(data);
  hubspot.populateFakeIds();
  logDir.hubspotOutputLogger()?.logResults(hubspot);
  return hubspot;
}

function pipeOutputToInput(hubspot: Hubspot, data: DataSet) {
  data.rawDeals = hubspot.dealManager.getArray().map(e => e.toRawEntity());
  data.rawContacts = hubspot.contactManager.getArray().map(e => e.toRawEntity());
  data.rawCompanies = hubspot.companyManager.getArray().map(e => e.toRawEntity());
}

function logDirNameGenerator() {
  let i = 0;
  const timestamp = Date.now();
  return () => `3x-${timestamp}-${++i}`;
}
