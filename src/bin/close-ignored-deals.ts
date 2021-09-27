import CachedFileDownloader from '../lib/io/downloader/cached-file-downloader.js';
import { downloadAllData } from '../lib/io/downloader/download-initial-data.js';
import { License } from '../lib/types/license.js';
import LiveUploader from '../lib/io/uploader/live-uploader.js';
import { DealStage } from '../lib/config/index.js';
import * as datadir from '../lib/cache/datadir.js';
import log from '../lib/log/logger.js';

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
