import 'source-map-support/register';
import DataDir from '../lib/data/dir';
import { DataSet } from '../lib/data/set';
import { Engine } from "../lib/engine/engine";
import { Hubspot } from '../lib/hubspot';
import log from "../lib/log/logger";
import { getCliArgs } from '../lib/parameters/cli-args';
import { engineConfigFromENV } from '../lib/parameters/env-config';

const { savelogs } = getCliArgs('savelogs');

const dataDir = DataDir.root.subdir('in');

let i = 0;
const nextDataDir = () => savelogs ? dataDir.subdir(`${savelogs}-${++i}`) : null;

const hubspot = Hubspot.memoryFromENV();

{
  // First
  let data = new DataSet(dataDir).load();
  const engine = new Engine(hubspot, engineConfigFromENV());
  log.level = log.Levels.Info;
  engine.run(data, nextDataDir());
}

{
  // Second
  const engine = new Engine(hubspot, engineConfigFromENV());
  let data = new DataSet(dataDir).load();
  data = { ...data, ...buildInputs(hubspot) };
  log.level = log.Levels.Verbose;
  engine.run(data, nextDataDir());
}

{
  // Third
  let data = new DataSet(dataDir).load();
  const engine = new Engine(hubspot, engineConfigFromENV());
  data = { ...data, ...buildInputs(hubspot) };
  log.level = log.Levels.Verbose;
  engine.run(data, nextDataDir());
}
