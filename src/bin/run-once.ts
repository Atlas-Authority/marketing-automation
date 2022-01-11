import 'source-map-support/register';
import DataDir from '../lib/cache/datadir';
import Engine from "../lib/engine/engine";
import log from '../lib/log/logger';
import { Database } from "../lib/model/database";
import { cli } from "../lib/parameters/cli-args";
import { envConfig } from '../lib/parameters/env-config';
import { ioFromCliArgs } from './cli-args';

main();
async function main() {

  log.setLevelFrom(cli.get('--loglevel'));
  const logDir = cli.get('--savelogs');

  const dataDir = logDir ? new DataDir(logDir) : null;

  const io = ioFromCliArgs();
  cli.failIfExtraOpts();

  const db = new Database(io, envConfig);

  await new Engine().run(db, dataDir);

}
