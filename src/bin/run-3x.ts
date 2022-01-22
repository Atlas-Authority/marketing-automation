import 'source-map-support/register';
import DataDir from '../lib/data/dir';
import Engine from "../lib/engine/engine";
import { loadDataFromDisk } from "../lib/io/downloader";
import { MemoryHubspot } from '../lib/io/memory/hubspot';
import log from "../lib/log/logger";
import { Database } from "../lib/model/database";
import { getCliArgs } from '../lib/parameters/cli-args';
import { envConfig } from '../lib/parameters/env-config';

main();
async function main() {

  const { savelogs } = getCliArgs('savelogs');

  const dataDir = DataDir.root.subdir('in');

  let i = 0;
  const nextDataDir = () => savelogs ? dataDir.subdir(`${savelogs}-${++i}`) : null;

  const engine = new Engine();
  const data = loadDataFromDisk(dataDir);

  // First
  log.level = log.Levels.Info;
  await engine.run(data, new Database(new MemoryHubspot(null), envConfig), nextDataDir());

  // Second
  log.level = log.Levels.Verbose;
  await engine.run(data, new Database(new MemoryHubspot(null), envConfig), nextDataDir());

  // Third
  log.level = log.Levels.Verbose;
  await engine.run(data, new Database(new MemoryHubspot(null), envConfig), nextDataDir());

}
