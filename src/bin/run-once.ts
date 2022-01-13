import 'source-map-support/register';
import DataDir from '../lib/cache/datadir';
import Engine from "../lib/engine/engine";
import { CachedMemoryRemote, IO } from '../lib/io/io';
import log from '../lib/log/logger';
import { Database } from "../lib/model/database";
import { cli } from "../lib/parameters/cli-args";
import { envConfig } from '../lib/parameters/env-config';

main();
async function main() {

  log.setLevelFrom(cli.get('--loglevel'));
  const logDir = cli.get('--savelogs');

  const dataDir = logDir ? new DataDir(logDir) : null;

  const io = new IO(new CachedMemoryRemote());
  cli.failIfExtraOpts();

  const db = new Database(io, envConfig);

  await new Engine().run(db, dataDir);

}
