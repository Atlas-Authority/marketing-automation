import { DealStage } from '../../config/index.js';
import log from '../../log/logger.js';
import { Deal, DealProps } from '../../model/hubspot/deal.js';
import { License } from '../../model/marketplace/license.js';
import { Transaction } from '../../model/marketplace/transaction.js';
import { isPresent, sorter } from '../../util/helpers.js';
import { LicenseContext } from '../license-grouper.js';
import { DealFinder } from './deal-finder.js';
import { DealRelevantEvent, EvalEvent, PurchaseEvent, RefundEvent, RenewalEvent, UpgradeEvent } from "./events.js";
import { dealCreationProperties, dealUpdateProperties } from './records.js';

export class ActionGenerator {

  constructor(private dealFinder: DealFinder) {
  }

  generateFrom(events: DealRelevantEvent[]) {
    return events.flatMap(event => this.actionsFor(event));
  }

  private actionsFor(event: DealRelevantEvent): Action[] {
    switch (event.type) {
      case 'eval': return [this.actionForEval(event)];
      case 'purchase': return [this.actionForPurchase(event)];
      case 'renewal': return [this.actionForRenewal(event)];
      case 'upgrade': return [this.actionForRenewal(event)];
      case 'refund': return this.actionsForRefund(event);
    }
  }

  private actionForEval(event: EvalEvent): Action {
    const deal = this.dealFinder.getDeal(event.licenses);
    const latestLicense = event.licenses[event.licenses.length - 1];
    if (!deal) {
      return makeCreateAction(event, latestLicense, DealStage.EVAL);
    }
    else if (deal.isEval()) {
      return makeUpdateAction(event, deal, latestLicense, {});
    }
    else {
      return makeIgnoreAction(event, deal, 'Deal already exists and is not eval');
    }
  }

  private actionForPurchase(event: PurchaseEvent): Action {
    const deal = (
      // Either it is an eval or a purchase without a transaction,
      this.dealFinder.getDeal(event.licenses) ||
      // or it exists as a purchase with a transaction
      this.dealFinder.getDeal(event.transaction
        ? [event.transaction]
        : [])
    );

    const record = getLatestRecord(event);
    if (!deal) {
      return makeCreateAction(event, record, DealStage.CLOSED_WON);
    }
    else if (deal.isEval()) {
      return makeUpdateAction(event, deal, record, { dealstage: DealStage.CLOSED_WON });
    }
    else {
      return makeIgnoreAction(event, deal, 'Deal already exists and is not eval');
    }
  }

  private actionForRenewal(event: RenewalEvent | UpgradeEvent): Action {
    const deal = this.dealFinder.getDeal([event.transaction]);
    if (deal) {
      return makeIgnoreAction(event, deal, 'Deal already exists for this transaction');
    }
    return makeCreateAction(event, event.transaction, DealStage.CLOSED_WON);
  }

  private actionsForRefund(event: RefundEvent): Action[] {
    const deals = this.dealFinder.getDeals(event.refundedTxs);
    return (deals
      .filter(deal => deal.data.dealstage !== DealStage.CLOSED_LOST)
      .map(deal => {
        return makeUpdateAction(event, deal, null, { dealstage: DealStage.CLOSED_LOST })
      })
      .filter(isPresent)
    );
  }

}

export type CreateDealAction = {
  type: 'create';
  groups: LicenseContext[];
  properties: DealProps;
};

export type UpdateDealAction = {
  type: 'update';
  groups: LicenseContext[];
  deal: Deal;
  properties: Partial<DealProps>;
};

export type IgnoreDealAction = {
  type: 'ignore';
  groups: LicenseContext[];
  reason: string;
};

export type Action = CreateDealAction | UpdateDealAction | IgnoreDealAction;

function makeCreateAction(event: DealRelevantEvent, record: License | Transaction, dealstage: DealStage): Action {
  return {
    type: 'create',
    groups: event.groups,
    properties: dealCreationProperties(record, dealstage),
  };
}

function makeUpdateAction(event: DealRelevantEvent, deal: Deal, record: License | Transaction | null, properties: Partial<DealProps>): Action {
  const combinedProperties = (record ? dealUpdateProperties(deal, record) : {});
  Object.assign(combinedProperties, properties);

  if (Object.keys(combinedProperties).length === 0) {
    return makeIgnoreAction(event, deal, 'No properties to update');
  }

  return {
    type: 'update',
    groups: event.groups,
    deal,
    properties: combinedProperties,
  };
}

function makeIgnoreAction(event: DealRelevantEvent, deal: Deal, reason: string): Action {
  reason = `${reason} (${deal.id})`;
  log.detailed('Deal Actions', `No action: ${reason}`);
  return { type: 'ignore', reason, groups: event.groups };
}

function getLatestRecord(event: PurchaseEvent): License | Transaction {
  const records: (License | Transaction)[] = [...event.licenses];
  if (event.transaction) records.push(event.transaction);
  return records.sort(sorter(item => item.data.maintenanceStartDate, 'DSC'))[0];
}
