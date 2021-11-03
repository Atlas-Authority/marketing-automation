import { saveForInspection } from '../lib/cache/inspection.js';
import { IO } from '../lib/io/io.js';
import log from '../lib/log/logger.js';
import { Database } from '../lib/model/database.js';
import { isPresent, sorter } from '../lib/util/helpers.js';

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
