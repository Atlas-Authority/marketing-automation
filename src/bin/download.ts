import 'source-map-support/register';
import DataDir from '../lib/data/dir';
import { Downloader } from "../lib/io/downloader";
import { serviceCredsFromENV } from '../lib/parameters/env-config';

main();
async function main() {

  const dataDir = DataDir.root.subdir("in");
  await new Downloader(dataDir, serviceCredsFromENV()).downloadData();

}
