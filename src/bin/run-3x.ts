import 'source-map-support/register';
import DataDir from '../lib/data/dir';
import Engine from "../lib/engine/engine";
import { CachedMemoryRemote, IO } from "../lib/io/io";
import log from "../lib/log/logger";
import { Database } from "../lib/model/database";
import { getCliArgs } from '../lib/parameters/cli-args';
import { envConfig } from '../lib/parameters/env-config';

main();
async function main() {

  let i = 0;
  const { savelogs } = getCliArgs('savelogs');
  const nextDataDir = () => savelogs ? new DataDir(`${savelogs}-${++i}`) : null;

  log.level = log.Levels.Info;

  const io = new IO(new CachedMemoryRemote());
  const engine = new Engine();

  // First
  await engine.run(new Database(io, envConfig), nextDataDir());

  // Second
  log.level = log.Levels.Verbose;
  await engine.run(new Database(io, envConfig), nextDataDir());

  // Third
  await engine.run(new Database(io, envConfig), nextDataDir());

}
