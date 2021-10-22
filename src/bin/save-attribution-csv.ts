import { saveForInspection } from '../lib/cache/inspection.js';
import CachedFileDownloader from '../lib/io/downloader/cached-file-downloader.js';
import ConsoleUploader from '../lib/io/uploader/console-uploader.js';
import { Database } from '../lib/model/database.js';
import { isPresent, sorter } from '../lib/util/helpers.js';

const db = new Database(new CachedFileDownloader(), new ConsoleUploader({ verbose: true }));
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
