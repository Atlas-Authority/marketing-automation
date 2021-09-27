import { Deal } from '../types/deal.js';
import { Uploader } from '../uploader/uploader.js';
import { DealStage, Pipeline } from '../util/config/index.js';
import log from '../util/log/logger.js';

export default async function ({ deals, uploader }: { deals: Deal[], uploader: Uploader }) {
  log.info('Zeroing Empty Deal Amounts', 'Setting Amount=0 on applicable Closed deals');
  const dealsToZero = deals.filter(deal =>
    deal.properties.pipeline === Pipeline.AtlassianMarketplace &&
    (
      deal.properties.dealstage === DealStage.CLOSED_WON ||
      deal.properties.dealstage === DealStage.CLOSED_LOST
    ) &&
    !deal.properties.amount // null, undefined, 0, and '' all apply
  );
  await uploader.updateAllDeals(dealsToZero.map(deal => {
    deal.properties.amount = '0';

    return ({
      id: deal.id,
      properties: { amount: deal.properties.amount },
    });
  }));

  log.info('Zeroing Empty Deal Amounts', 'Setting Amount=null on applicable Eval deals');
  const dealsToNullify = deals.filter(deal =>
    deal.properties.pipeline === Pipeline.AtlassianMarketplace &&
    deal.properties.dealstage === DealStage.EVAL &&
    (deal.properties.amount === '0' || deal.properties.amount === '0.00')
  );
  await uploader.updateAllDeals(dealsToNullify.map(deal => {
    deal.properties.amount = '';

    return ({
      id: deal.id,
      properties: { amount: deal.properties.amount },
    });
  }));

  log.info('Zeroing Empty Deal Amounts', 'Done');
}
