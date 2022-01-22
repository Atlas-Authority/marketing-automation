import 'source-map-support/register';
import DataDir from '../lib/data/dir';
import { printSummary } from "../lib/engine/summary";
import { loadDataFromDisk } from '../lib/io/downloader';
import { Database } from "../lib/model/database";
import { envConfig } from '../lib/parameters/env-config';

main();
async function main() {

  const db = new Database(null, envConfig);
  const data = loadDataFromDisk(DataDir.root.subdir('in'));
  db.importData(data);
  printSummary(db);

}
