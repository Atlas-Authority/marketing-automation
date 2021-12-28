import 'source-map-support/register';
import Engine from "../lib/engine/engine";
import { IO } from "../lib/io/io";
import log from "../lib/log/logger";
import { Database } from "../lib/model/database";
import { cli } from "../lib/parameters/cli-args";
import { envConfig } from '../lib/parameters/env-config';

main();
async function main() {

  cli.failIfExtraOpts();
  log.level = log.Levels.Info;

  const io = new IO({ in: 'local', out: 'local' });
  const engine = new Engine();

  // First
  await engine.run(new Database(io, envConfig));

  // Second
  log.level = log.Levels.Verbose;
  await engine.run(new Database(io, envConfig));

  // Third
  await engine.run(new Database(io, envConfig));

}
