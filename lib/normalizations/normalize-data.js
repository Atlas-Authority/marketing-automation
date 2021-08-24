import zeroEmptyDealAmounts from './zero-empty-deal-amounts.js';

/**
 * @param {object} options
 * @param {Downloader} options.downloader
 * @param {Uploader} options.uploader
 */
export default async function ({ downloader, uploader }) {
  await zeroEmptyDealAmounts({ downloader, uploader });
};
