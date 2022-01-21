import 'source-map-support/register';
import DataDir from '../lib/data/dir';
import { loadDataFromDisk } from "../lib/io/io";
import { MemoryHubspot } from '../lib/io/memory/hubspot';
import log from "../lib/log/logger";
import { Database } from "../lib/model/database";
import { envConfig } from '../lib/parameters/env-config';
import { isPresent, sorter } from "../lib/util/helpers";

main();
async function main() {

  log.level = log.Levels.Verbose;
  const db = new Database(new MemoryHubspot(null), envConfig);
  const data = loadDataFromDisk(DataDir.root.subdir('in'));
  db.importData(data);

  const attributions = (db
    .licenses
    .map(l => l.data.attribution)
    .filter(isPresent)
    .sort(sorter(a => [
      Object.keys(a).length,
      a.channel,
      a.referrerDomain,
    ].join(',')))
  );

  DataDir.root.subdir('inspect').file('attributions.csv').writeArray(attributions.map(a => ({
    channel: a.channel,
    referrerDomain: a.referrerDomain,
    campaignName: a.campaignName,
    campaignSource: a.campaignSource,
    campaignMedium: a.campaignMedium,
    campaignContent: a.campaignContent,
  })));

}
