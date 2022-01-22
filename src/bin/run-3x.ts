import 'source-map-support/register';
import DataDir from '../lib/data/dir';
import { DataSet } from '../lib/data/set';
import { Engine } from "../lib/engine/engine";
import { HubspotService } from '../lib/hubspot/service';
import log from "../lib/log/logger";
import { getCliArgs } from '../lib/parameters/cli-args';
import { engineConfigFromENV } from '../lib/parameters/env-config';

main();
async function main() {

  const { savelogs } = getCliArgs('savelogs');

  const dataDir = DataDir.root.subdir('in');

  let i = 0;
  const nextDataDir = () => savelogs ? dataDir.subdir(`${savelogs}-${++i}`) : null;

  const data = new DataSet(dataDir).load();
  const engine = new Engine(HubspotService.memory(), engineConfigFromENV());

  // First
  log.level = log.Levels.Info;
  await engine.run(data, nextDataDir());

  // Second
  log.level = log.Levels.Verbose;
  await engine.run(data, nextDataDir());

  // Third
  log.level = log.Levels.Verbose;
  await engine.run(data, nextDataDir());

}
