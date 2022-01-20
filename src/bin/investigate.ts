import 'source-map-support/register';
import { printSummary } from "../lib/engine/summary";
import { CachedMemoryRemote, IO } from "../lib/io/io";
import { Database } from "../lib/model/database";
import { envConfig } from '../lib/parameters/env-config';

main();
async function main() {

  const db = new Database(new IO(new CachedMemoryRemote()), envConfig);
  const data = await db.downloadData();
  db.importData(data);
  printSummary(db);

}
