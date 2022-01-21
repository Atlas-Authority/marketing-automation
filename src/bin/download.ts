import 'source-map-support/register';
import DataDir from '../lib/data/dir';
import { Downloader } from "../lib/io/downloader";
import log from "../lib/log/logger";
import { serviceCredsFromENV } from '../lib/parameters/env-config';

main();
async function main() {

  const dataDir = DataDir.root.subdir("in");

  log.level = log.Levels.Verbose;
  await new Downloader(dataDir, serviceCredsFromENV()).downloadData();

}
