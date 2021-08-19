import zeroEmptyDealAmounts from './zero-empty-deal-amounts.js';
import * as logger from '../util/logger.js';

/**
 * @param {object} options
 * @param {Downloader} options.downloader
 * @param {Uploader} options.uploader
 */
export default async function ({ downloader, uploader }) {
  logger.info('Data Normalization', 'Running data-normalization tasks');

  await zeroEmptyDealAmounts({ downloader, uploader });
};
