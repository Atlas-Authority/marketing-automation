import 'source-map-support/register';
import DataDir from '../lib/data/datadir';
import { CachedMemoryRemote, IO } from "../lib/io/io";
import log from "../lib/log/logger";
import { Database } from "../lib/model/database";
import { envConfig } from '../lib/parameters/env-config';
import { isPresent, sorter } from "../lib/util/helpers";

main();
async function main() {

  log.level = log.Levels.Verbose;
  const db = new Database(new IO(new CachedMemoryRemote()), envConfig);
  await db.downloadAllData();

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

  new DataDir('inspect').file('attributions.csv').writeArray(attributions.map(a => ({
    channel: a.channel,
    referrerDomain: a.referrerDomain,
    campaignName: a.campaignName,
    campaignSource: a.campaignSource,
    campaignMedium: a.campaignMedium,
    campaignContent: a.campaignContent,
  })));

}
