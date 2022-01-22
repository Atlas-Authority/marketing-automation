import 'source-map-support/register';
import DataDir from '../lib/data/dir';
import { DataSet } from '../lib/data/set';
import { Engine } from "../lib/engine/engine";
import { printSummary } from "../lib/engine/summary";
import { engineConfigFromENV } from '../lib/parameters/env-config';

main();
async function main() {

  const db = new Engine(null, engineConfigFromENV());
  const data = new DataSet(DataDir.root.subdir('in')).load();
  db.importData(data);
  printSummary(db);

}
