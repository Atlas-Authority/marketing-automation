import 'source-map-support/register';
import DataDir from '../lib/data/dir';
import { DataSet } from '../lib/data/set';
import { printSummary } from "../lib/engine/summary";
import { Database } from "../lib/model/database";
import { engineConfigFromENV } from '../lib/parameters/env-config';

main();
async function main() {

  const db = new Database(null, engineConfigFromENV());
  const data = new DataSet(DataDir.root.subdir('in')).load();
  db.importData(data);
  printSummary(db);

}
