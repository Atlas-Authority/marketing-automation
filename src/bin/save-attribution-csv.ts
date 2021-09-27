import CachedFileDownloader from '../lib/io/downloader/cached-file-downloader.js';
import { downloadAllData } from '../lib/io/downloader/download-initial-data.js';
import { isPresent, sorter } from '../lib/util/helpers.js';
import { saveForInspection } from '../lib/cache/inspection.js';

const data = await downloadAllData({
  downloader: new CachedFileDownloader()
});

const attributions = (data
  .allLicenses
  .map(l => l.attribution)
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
