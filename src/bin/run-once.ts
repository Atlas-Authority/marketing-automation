import 'source-map-support/register';
import DataDir from '../lib/data/dir';
import Engine from "../lib/engine/engine";
import { CachedMemoryRemote } from '../lib/io/io';
import { MemoryHubspot } from '../lib/io/memory/hubspot';
import log from '../lib/log/logger';
import { Database } from "../lib/model/database";
import { getCliArgs } from '../lib/parameters/cli-args';
import { envConfig } from '../lib/parameters/env-config';

main();
async function main() {
  const { loglevel, savelogs } = getCliArgs('loglevel', 'savelogs');

  log.setLevelFrom(loglevel);

  const logDir = savelogs ? DataDir.root.subdir("in").subdir(savelogs) : null;

  const db = new Database(new MemoryHubspot(null), envConfig);

  await new Engine().run(new CachedMemoryRemote(), db, logDir);
}
