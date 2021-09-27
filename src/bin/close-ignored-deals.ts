import CachedFileDownloader from '../lib/downloader/cached-file-downloader.js';
import { downloadAllData } from '../lib/downloader/download-initial-data.js';
import { License } from '../lib/types/license.js';
import LiveUploader from '../lib/uploader/live-uploader.js';
import { DealStage } from '../lib/util/config/index.js';
import * as datadir from '../lib/util/cache/datadir.js';
import log from '../lib/util/log/logger.js';

const data = await downloadAllData({
  downloader: new CachedFileDownloader()
});

const uploader = new LiveUploader();

const ignored: (License & { reason: string })[][] = datadir.readJsonFile('out', 'ignored.json');

const openDeals = data.allDeals.filter(deal => deal.properties.dealstage === DealStage.EVAL);

const dealsToClose = (openDeals
  .map(deal => ({
    deal,
    ignoredGroup: ignored.filter(group =>
      group.some(row =>
        row.addonLicenseId === deal.properties.addonlicenseid))[0],
  }))
  .filter(({ ignoredGroup }) => ignoredGroup)
  .map(({ deal, ignoredGroup }) => ({
    id: deal.id,
    dealname: deal.properties.dealname,
    stage: ignoredGroup.every(row => row.licenseType === 'EVALUATION')
      ? DealStage.CLOSED_LOST
      : DealStage.CLOSED_WON,
    reasonsIgnored: ignoredGroup.map(row => row.reason),
  }))
);

log.info('Deals', dealsToClose);

uploader.updateAllDeals(dealsToClose.map(row => ({
  id: row.id,
  properties: {
    dealstage: row.stage,
  },
})));
