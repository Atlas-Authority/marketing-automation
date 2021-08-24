import { Pipeline } from '../util/config.js';
import * as logger from '../util/logger.js';

/**
 * @param {object} options
 * @param {Downloader} options.downloader
 * @param {Uploader} options.uploader
 */
export default async function ({ downloader, uploader }) {
  logger.info('Zeroing Empty Deal Amounts', 'Downloading data');
  const deals = await downloader.downloadAllDeals();

  logger.info('Zeroing Empty Deal Amounts', 'Filtering deals');
  const dealsToFix = deals.filter(deal =>
    deal.properties.pipeline === Pipeline.AtlassianMarketplace &&
    !deal.properties.amount // null, undefined, 0, and '' all apply
  );

  logger.info('Zeroing Empty Deal Amounts', 'Fixing deals');
  await uploader.updateAllDeals(dealsToFix.map(deal => ({
    id: deal.id,
    properties: { amount: '0' },
  })));

  logger.info('Zeroing Empty Deal Amounts', 'Done');
}
