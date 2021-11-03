import { saveForInspection } from '../lib/cache/inspection.js';
import { MemoryRemote } from '../lib/io/memory-remote.js';
import log from '../lib/log/logger.js';
import { Database } from '../lib/model/database.js';
import { isPresent, sorter } from '../lib/util/helpers.js';

log.level = log.Levels.Verbose;
const memoryRemote = new MemoryRemote();
const db = new Database(memoryRemote, memoryRemote);
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
