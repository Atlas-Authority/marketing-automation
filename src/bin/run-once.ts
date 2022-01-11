import 'source-map-support/register';
import Engine from "../lib/engine/engine";
import log from '../lib/log/logger';
import { Database } from "../lib/model/database";
import { cli } from "../lib/parameters/cli-args";
import { envConfig } from '../lib/parameters/env-config';
import { ioFromCliArgs } from './cli-args';

main();
async function main() {

  log.setLevelFrom(cli.get('--loglevel'));

  const io = ioFromCliArgs();
  cli.failIfExtraOpts();

  const db = new Database(io, envConfig);

  await new Engine().run(db, cli.get('--savelogs') === 'true');

}
