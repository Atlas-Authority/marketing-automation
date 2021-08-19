import { downloadAllData } from '../downloader/download-initial-data.js';
import { DealStage, Pipeline } from '../util/config.js';
import * as logger from '../util/logger.js';

/**
 * @param {object} options
 * @param {Downloader} options.downloader
 * @param {Uploader} options.uploader
 */
export default async function ({ downloader, uploader }) {
  logger.info('Zeroing Empty Deal Amounts', 'Downloading data');
  const data = await downloadAllData({ downloader });

  logger.info('Zeroing Empty Deal Amounts', 'Filtering deals');
  const dealsToFix = data.allDeals.filter(deal =>
    deal.properties.pipeline === Pipeline.AtlassianMarketplace &&
    (
      deal.properties.dealstage === DealStage.CLOSED_LOST ||
      deal.properties.dealstage === DealStage.CLOSED_WON
    ) &&
    !deal.properties.amount // null, undefined, 0, and '' all apply
  );

  logger.info('Zeroing Empty Deal Amounts', 'Fixing deals');
  await uploader.updateAllDeals(dealsToFix.map(deal => ({
    id: deal.id,
    properties: { amount: '0' },
  })));

  logger.info('Zeroing Empty Deal Amounts', 'Done');
}
