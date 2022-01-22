import 'source-map-support/register';
import DataDir from '../lib/data/dir';
import { DataSet } from '../lib/data/set';
import { downloadAllData } from '../lib/engine/download';

main();
async function main() {

  const dataDir = DataDir.root.subdir("in");
  const dataSet = new DataSet(dataDir);
  await downloadAllData(dataSet);

}
