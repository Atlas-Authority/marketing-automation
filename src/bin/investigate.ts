import 'source-map-support/register';
import { printSummary } from "../lib/engine/summary";
import { IO } from "../lib/io/io";
import { Database } from "../lib/model/database";

main();
async function main() {

  const db = new Database(new IO({ in: 'local', out: 'local' }));
  await db.downloadAllData();
  printSummary(db);

}
