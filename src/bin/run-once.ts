import 'source-map-support/register';
import Engine from "../lib/engine/engine";
import { IO } from "../lib/io/io";
import { Database } from "../lib/model/database";
import { cli } from "../lib/parameters/cli";

main();
async function main() {

  const io = IO.fromCli();
  cli.failIfExtraOpts();

  const db = new Database(io);

  await new Engine().run(db);

}
