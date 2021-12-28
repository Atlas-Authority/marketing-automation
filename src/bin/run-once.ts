import 'source-map-support/register';
import { useCachedFunctions } from '../lib/cache/fn-cache';
import Engine from "../lib/engine/engine";
import { IO } from "../lib/io/io";
import log from '../lib/log/logger';
import { Database } from "../lib/model/database";
import { cli } from "../lib/parameters/cli-args";
import { envConfig } from '../lib/parameters/env-config';

main();
async function main() {

  log.setLevelFrom(cli.get('--loglevel'));
  useCachedFunctions(cli.get('--cached-fns')?.split(','));

  const io = new IO({
    in: cli.getChoiceOrFail('--in', ['local', 'remote']),
    out: cli.getChoiceOrFail('--out', ['local', 'remote']),
  });
  cli.failIfExtraOpts();

  const db = new Database(io, envConfig);

  await new Engine().run(db);

}
