import 'source-map-support/register';
import Engine from "../lib/engine/engine";
import { CachedMemoryRemote, IO } from '../lib/io/io';
import log from '../lib/log/logger';
import { Database } from "../lib/model/database";
import { getCliArgs } from '../lib/parameters/cli-args';
import { envConfig } from '../lib/parameters/env-config';

main();
async function main() {
  const { loglevel, savelogs } = getCliArgs('loglevel', 'savelogs');

  log.setLevelFrom(loglevel);

  const remote = new CachedMemoryRemote();
  const dataDir = savelogs ? remote.dataDir.subdir(savelogs) : null;

  const io = new IO(remote);
  const db = new Database(io, envConfig);

  await new Engine().run(db, dataDir);
}
