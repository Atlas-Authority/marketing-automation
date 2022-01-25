import 'source-map-support/register';
import DataDir from '../lib/data/dir';
import { Data, DataSet } from '../lib/data/set';
import { Engine } from "../lib/engine/engine";
import { Hubspot } from '../lib/hubspot';
import { Entity } from '../lib/hubspot/entity';
import { FullEntity, RelativeAssociation } from '../lib/hubspot/interfaces';
import { Logger } from '../lib/log';
import { engineConfigFromENV } from '../lib/parameters/env-config';

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
  const hubspot = Hubspot.memoryFromENV(log);
  const engine = new Engine(log, hubspot, engineConfigFromENV());
  engine.run(data);
  log.hubspotResultLogger().logResults(hubspot);
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

function fillInIds(entities: Iterable<Entity<any>>) {
  let id = 0;
  for (const e of entities) {
    if (!e.id) e.id = `fake-${e.kind}-${++id}`;
  }
}

function toRawEntity(entity: Entity<any>): FullEntity {
  return {
    id: entity.id!,
    properties: entity.upsyncableData(),
    associations: [...entity.upsyncableAssociations()].map(other => {
      return `${other.kind}:${other.id}` as RelativeAssociation;
    }),
  };
}
