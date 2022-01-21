import 'source-map-support/register';
import { downloadData } from '../lib/engine/downloader';
import { LiveRemote } from "../lib/io/io";
import log from "../lib/log/logger";
import { serviceCredsFromENV } from '../lib/parameters/env-config';

main();
async function main() {

  log.level = log.Levels.Verbose;
  await downloadData(new LiveRemote(serviceCredsFromENV()));

}
