import 'source-map-support/register';
import DataDir from '../lib/data/dir';
import { DataSet } from '../lib/data/set';
import { Engine } from "../lib/engine/engine";
import { Hubspot } from '../lib/hubspot';
import { ConsoleLogger } from '../lib/log/logger';
import { getCliArgs } from '../lib/parameters/cli-args';
import { engineConfigFromENV } from '../lib/parameters/env-config';

const { savelogs } = getCliArgs('savelogs');

const dataDir = DataDir.root.subdir('in');

let i = 0;
const nextDataDir = () => savelogs ? dataDir.subdir(`${savelogs}-${++i}`) : null;

const data = new DataSet(dataDir).load();

const log = new ConsoleLogger();

function logFileUploader(dataFile: DataDir) {

}

// const consoleUploader: HubspotUploader = {
//   createAssociations(fromKind, toKind, inputs) {

//   },

// };

runEngine();

// pipeOutputToInput(hubspot, data);
runEngine();

// pipeOutputToInput(hubspot, data);
runEngine();

function runEngine() {
  const hubspot = Hubspot.memoryFromENV(log);
  const engine = new Engine(log, hubspot, engineConfigFromENV());
  engine.run(data, nextDataDir());
}

// function pipeOutputToInput(hubspot: Hubspot, data: Data) {
//   data.rawDeals = applyChanges(hubspot.dealManager);
//   data.rawContacts = applyChanges(hubspot.contactManager);
//   data.rawCompanies = applyChanges(hubspot.companyManager);
// }

// function applyChanges<D, C, E extends Entity<D, C>>(manager: EntityManager<D, C, E>): FullEntity[] {
//   let i = 0;
//   return manager.getArray().map(entity => {
//     return {
//       id: entity.id ?? `fake-${entity.kind}:${++i}`,
//       properties: entity.data,
//       // associations: [],
//     } as FullEntity;
//   });
// }
