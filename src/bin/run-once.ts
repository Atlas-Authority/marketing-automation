import 'source-map-support/register';
import Engine from "../lib/engine/engine";
import { IO } from "../lib/io/io";
import log from '../lib/log/logger';
import { Database } from "../lib/model/database";
import { cli } from "../lib/parameters/cli";

main();
async function main() {

  log.setLevelFrom(cli.get('--loglevel'));

  const io = new IO({
    in: cli.getChoiceOrFail('--in', ['local', 'remote']),
    out: cli.getChoiceOrFail('--out', ['local', 'remote']),
  });
  cli.failIfExtraOpts();

  const db = new Database(io);

  await new Engine().run(db);

}
