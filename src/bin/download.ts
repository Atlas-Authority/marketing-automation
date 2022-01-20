import 'source-map-support/register';
import { IO, LiveRemote, MemoryRemote } from "../lib/io/io";
import log from "../lib/log/logger";
import { Database } from "../lib/model/database";
import { envConfig, serviceCredsFromENV } from '../lib/parameters/env-config';

main();
async function main() {

  log.level = log.Levels.Verbose;
  const io = new IO();
  io.in = new LiveRemote(serviceCredsFromENV());
  io.out = new MemoryRemote();
  const db = new Database(io, envConfig);
  const data = await db.downloadData();
  db.importData(data);

}
