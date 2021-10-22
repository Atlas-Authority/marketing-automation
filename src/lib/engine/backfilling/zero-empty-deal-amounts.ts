import assert from 'assert';
import { Pipeline } from '../../config/index.js';
import log from '../../log/logger.js';
import { Deal } from '../../model/deal.js';

export default function (deals: Deal[]) {
  assert.ok(deals.every(deal => deal.data.pipeline === Pipeline.AtlassianMarketplace));

  log.info('Zeroing Empty Deal Amounts', 'Normalizing where !Amount, Amount=0 if Closed, Amount=null if Eval');
  for (const deal of deals) {
    if (deal.isClosed()) {
      if (!deal.data.amount) deal.data.amount = 0;
    }
    else {
      if (!deal.data.amount) deal.data.amount = null;
    }
  }
}
