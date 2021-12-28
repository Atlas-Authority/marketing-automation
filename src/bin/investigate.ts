import 'source-map-support/register';
import { printSummary } from "../lib/engine/summary";
import { IO } from "../lib/io/io";
import { Database } from "../lib/model/database";
import { envConfig } from '../lib/parameters/env-config';

main();
async function main() {

  const db = new Database(new IO({ in: 'local', out: 'local' }), envConfig);
  await db.downloadAllData();
  printSummary(db);

}
