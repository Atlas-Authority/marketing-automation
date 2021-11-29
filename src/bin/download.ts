import 'source-map-support/register';
import { IO } from "../lib/io/io";
import log from "../lib/log/logger";
import { Database } from "../lib/model/database";

main();
async function main() {

  log.level = log.Levels.Verbose;
  const db = new Database(new IO({ in: 'remote', out: 'local' }));
  await db.downloadAllData();

}
