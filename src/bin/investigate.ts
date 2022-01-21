import 'source-map-support/register';
import { downloadData } from '../lib/engine/downloader';
import { printSummary } from "../lib/engine/summary";
import { CachedMemoryRemote } from "../lib/io/io";
import { Database } from "../lib/model/database";
import { envConfig } from '../lib/parameters/env-config';

main();
async function main() {

  const db = new Database(new CachedMemoryRemote(), envConfig);
  const data = await downloadData(new CachedMemoryRemote());
  db.importData(data);
  printSummary(db);

}
