import 'source-map-support/register';
import DataDir from '../lib/data/dir';
import { Data, DataSet } from '../lib/data/set';
import { Engine } from "../lib/engine/engine";
import { Hubspot } from '../lib/hubspot';
import { Entity } from '../lib/hubspot/entity';
import { FullEntity, RelativeAssociation } from '../lib/hubspot/interfaces';
import { logHubspotResults } from '../lib/hubspot/log-results';
import { ConsoleLogger } from '../lib/log/logger';
import { getCliArgs } from '../lib/parameters/cli-args';
import { engineConfigFromENV } from '../lib/parameters/env-config';

const { savelogs } = getCliArgs('savelogs');

const dataDir = DataDir.root.subdir('in');

let i = 0;
const nextDataDir = () => savelogs ? dataDir.subdir(`${savelogs}-${++i}`) : null;

const data = new DataSet(dataDir).load();

let hubspot: Hubspot;
hubspot = runEngine();

pipeOutputToInput(hubspot, data);
hubspot = runEngine();

pipeOutputToInput(hubspot, data);
hubspot = runEngine();

function runEngine() {
  const log = new ConsoleLogger();
  const hubspot = Hubspot.memoryFromENV(log);
  const engine = new Engine(log, hubspot, engineConfigFromENV());
  const logDir = nextDataDir();
  engine.run(data, logDir);
  if (logDir) logHubspotResults(hubspot, logDir.file('hubspot-out.txt'));
  return hubspot;
}

function pipeOutputToInput(hubspot: Hubspot, data: Data) {
  fillInIds(hubspot.dealManager.getAll());
  fillInIds(hubspot.contactManager.getAll());
  fillInIds(hubspot.companyManager.getAll());

  data.rawDeals = hubspot.dealManager.getArray().map(toRawEntity);
  data.rawContacts = hubspot.contactManager.getArray().map(toRawEntity);
  data.rawCompanies = hubspot.companyManager.getArray().map(toRawEntity);
}

function fillInIds(entities: Iterable<Entity<any, any>>) {
  let id = 0;
  for (const e of entities) {
    if (!e.id) e.id = `fake-${e.adapter.kind}-${++id}`;
  }
}

function toRawEntity(entity: Entity<any, any>): FullEntity {
  return {
    id: entity.id!,
    properties: entity.upsyncableData() as Record<string, string>,
    associations: [...entity.upsyncableAssociations()].map(other => {
      return `${other.kind}:${other.id}` as RelativeAssociation;
    }),
  };
}
