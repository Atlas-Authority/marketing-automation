import { IO } from '../lib/io/io.js';
import log from '../lib/log/logger.js';
import { Database } from '../lib/model/database.js';

main();
async function main() {

  log.level = log.Levels.Verbose;
  const db = new Database(new IO({ in: 'remote', out: 'local' }));
  await db.downloadAllData();

}
