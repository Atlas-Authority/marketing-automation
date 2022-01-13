import 'source-map-support/register';
import DataDir from '../lib/cache/datadir';
import Engine from "../lib/engine/engine";
import { CachedMemoryRemote, IO } from "../lib/io/io";
import log from "../lib/log/logger";
import { Database } from "../lib/model/database";
import { cli } from "../lib/parameters/cli-args";
import { envConfig } from '../lib/parameters/env-config';

main();
async function main() {

  cli.failIfExtraOpts();
  log.level = log.Levels.Info;

  const io = new IO(new CachedMemoryRemote());
  const engine = new Engine();

  // First
  await engine.run(new Database(io, envConfig), new DataDir('run1'));

  // Second
  log.level = log.Levels.Verbose;
  await engine.run(new Database(io, envConfig), new DataDir('run2'));

  // Third
  await engine.run(new Database(io, envConfig), new DataDir('run3'));

}
