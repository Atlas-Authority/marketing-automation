import * as datadir from '../lib/cache/datadir.js';
import { DealStage } from '../lib/config/index.js';
import CachedFileDownloader from '../lib/io/downloader/cached-file-downloader.js';
import LiveUploader from '../lib/io/uploader/live-uploader.js';
import log from '../lib/log/logger.js';
import { Database } from '../lib/model/database.js';
import { License } from '../lib/types/license.js';

const db = new Database(new CachedFileDownloader(), new LiveUploader());

const ignored: (License & { reason: string })[][] = datadir.readJsonFile('out', 'ignored.json');

const openDeals = db.dealManager.getArray().filter(deal => !deal.isClosed());

const dealsToClose = (openDeals
  .map(deal => ({
    deal,
    ignoredGroup: ignored.filter(group =>
      group.some(row =>
        row.addonLicenseId === deal.data.addonLicenseId))[0],
  }))
  .filter(({ ignoredGroup }) => ignoredGroup)
  .map(({ deal, ignoredGroup }) => ({
    deal,
    stage: ignoredGroup.every(row => row.licenseType === 'EVALUATION')
      ? DealStage.CLOSED_LOST
      : DealStage.CLOSED_WON,
    reasonsIgnored: ignoredGroup.map(row => row.reason),
  }))
);

log.info('Deals', dealsToClose.map(({ deal, reasonsIgnored, stage }) => ({
  id: deal.id,
  dealname: deal.data.dealName,
  stage,
  reasonsIgnored,
})));

for (const { deal, stage } of dealsToClose) {
  deal.data.dealstage = stage;
}

await db.dealManager.syncUpAllEntities();
