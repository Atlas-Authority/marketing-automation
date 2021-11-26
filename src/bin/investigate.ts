import { printSummary } from '../lib/engine/summary.js';
import { IO } from '../lib/io/io.js';
import { Database } from '../lib/model/database.js';

main();
async function main() {

  const db = new Database(new IO({ in: 'local', out: 'local' }));
  await db.downloadAllData();
  printSummary(db);

}
