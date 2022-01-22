import 'source-map-support/register';
import DataDir from '../lib/data/dir';
import { DataSet } from '../lib/data/set';
import { Downloader } from "../lib/io/downloader";
import { serviceCredsFromENV } from '../lib/parameters/env-config';

main();
async function main() {

  const dataDir = DataDir.root.subdir("in");
  const dataSet = new DataSet(dataDir);
  await new Downloader(dataSet, serviceCredsFromENV()).downloadData();

}
