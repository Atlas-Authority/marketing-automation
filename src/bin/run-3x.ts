import 'source-map-support/register';
import Engine from "../lib/engine/engine";
import { CachedMemoryRemote } from "../lib/io/io";
import log from "../lib/log/logger";
import { Database } from "../lib/model/database";
import { getCliArgs } from '../lib/parameters/cli-args';
import { envConfig } from '../lib/parameters/env-config';

main();
async function main() {

  let i = 0;
  const { savelogs } = getCliArgs('savelogs');

  log.level = log.Levels.Info;

  const remote = new CachedMemoryRemote();
  const nextDataDir = () => savelogs ? remote.dataDir.subdir(`${savelogs}-${++i}`) : null;

  const engine = new Engine();

  // First
  await engine.run(remote, new Database(remote, envConfig), nextDataDir());

  // Second
  log.level = log.Levels.Verbose;
  await engine.run(remote, new Database(remote, envConfig), nextDataDir());

  // Third
  await engine.run(remote, new Database(remote, envConfig), nextDataDir());

}
