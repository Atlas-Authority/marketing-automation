import 'source-map-support/register';
import DataDir from '../lib/data/dir';
import { DataSet } from '../lib/data/set';
import { Engine } from "../lib/engine/engine";
import log from '../lib/log/logger';
import { getCliArgs } from '../lib/parameters/cli-args';
import { engineConfigFromENV } from '../lib/parameters/env-config';

main();
async function main() {
  const { loglevel, savelogs } = getCliArgs('loglevel', 'savelogs');

  log.setLevelFrom(loglevel);

  const dataDir = DataDir.root.subdir('in');
  const logDir = savelogs ? dataDir.subdir(savelogs) : null;

  const engine = new Engine(null, engineConfigFromENV());

  const data = new DataSet(dataDir).load();

  await engine.run(data, logDir);
}
