import { Pipeline } from '../util/config.js';
import * as logger from '../util/logger.js';

/**
 * @param {object} options
 * @param {Deal[]} options.deals
 * @param {Uploader} options.uploader
 */
export default async function ({ deals, uploader }) {
  logger.info('Zeroing Empty Deal Amounts', 'Filtering deals');
  const dealsToFix = deals.filter(deal =>
    deal.properties.pipeline === Pipeline.AtlassianMarketplace &&
    !deal.properties.amount // null, undefined, 0, and '' all apply
  );

  logger.info('Zeroing Empty Deal Amounts', 'Fixing deals');
  await uploader.updateAllDeals(dealsToFix.map(deal => {
    deal.properties.amount = '0';

    return ({
      id: deal.id,
      properties: { amount: deal.properties.amount },
    });
  }));

  logger.info('Zeroing Empty Deal Amounts', 'Done');
}
