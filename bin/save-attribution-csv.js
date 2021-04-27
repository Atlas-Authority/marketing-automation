import CachedFileDownloader from '../lib/downloader/cached-file-downloader.js';
import { downloadInitialData } from '../lib/downloader/download-initial-data.js';
import { isPresent, sorter } from '../lib/util/helpers.js';
import { saveForInspection } from '../lib/util/inspection.js';

const data = await downloadInitialData({
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
