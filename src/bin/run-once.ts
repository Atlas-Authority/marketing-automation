import 'source-map-support/register';
import DataDir from '../lib/data/dir';
import Engine from "../lib/engine/engine";
import { loadDataFromDisk } from '../lib/io/downloader';
import log from '../lib/log/logger';
import { Database } from "../lib/model/database";
import { getCliArgs } from '../lib/parameters/cli-args';
import { envConfig } from '../lib/parameters/env-config';

main();
async function main() {
  const { loglevel, savelogs } = getCliArgs('loglevel', 'savelogs');

  log.setLevelFrom(loglevel);

  const dataDir = DataDir.root.subdir('in');
  const logDir = savelogs ? dataDir.subdir(savelogs) : null;

  const db = new Database(null, envConfig);

  const data = loadDataFromDisk(dataDir);

  await new Engine().run(data, db, logDir);
}
