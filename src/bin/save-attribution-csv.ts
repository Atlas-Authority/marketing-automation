import { saveForInspection } from "../lib/cache/inspection";
import { IO } from "../lib/io/io";
import log from "../lib/log/logger";
import { Database } from "../lib/model/database";
import { isPresent, sorter } from "../lib/util/helpers";

main();
async function main() {

  log.level = log.Levels.Verbose;
  const db = new Database(new IO({ in: 'local', out: 'local' }));
  await db.downloadAllData();

  const attributions = (db
    .licenses
    .map(l => l.data.attribution)
    .filter(isPresent)
  );

  saveForInspection('attributions', attributions
    .sort(sorter(a => [
      Object.keys(a).length,
      a.channel,
      a.referrerDomain,
    ].join(',')))
    .map(a => ({
      channel: a.channel,
      referrerDomain: a.referrerDomain,
      campaignName: a.campaignName,
      campaignSource: a.campaignSource,
      campaignMedium: a.campaignMedium,
      campaignContent: a.campaignContent,
    }))
  );

}
