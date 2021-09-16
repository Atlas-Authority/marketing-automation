import assert from 'assert';
import { DealStage } from '../../util/config.js';
import { isPresent } from '../../util/helpers.js';
import { Outcome } from "./decision-matrix.js";
import { DealRelevantEvent, EvalEvent, PurchaseEvent, RefundEvent, RenewalEvent, UpgradeEvent } from "./events.js";

export class ActionGenerator {

  allTransactionDeals = new Map<string, Deal>();
  allLicenseDeals = new Map<string, Deal>();

  constructor(initialDeals: Deal[]) {
    for (const deal of initialDeals) {
      if (deal.properties.addonlicenseid) {
        this.allLicenseDeals.set(deal.properties.addonlicenseid, deal);
      }
      if (deal.properties.transactionid) {
        this.allTransactionDeals.set(deal.properties.transactionid, deal);
      }
    }
  }

  generateFrom(events: DealRelevantEvent[]) {
    const actions: Action[] = [];
    for (const event of events) {
      const action = this.actionFor(event);
      if (action) {
        actions.push(action);
      }
    }
    return actions;
  }

  private actionFor(event: DealRelevantEvent): Action | null {
    switch (event.type) {
      case 'eval': return this.actionForEval(event);
      case 'purchase': return this.actionForPurchase(event);
      case 'renewal': return this.actionForRenewal(event);
      case 'upgrade': return this.actionForRenewal(event);
      case 'refund': return this.actionForRefund(event);
    }
  }

  private actionForEval(event: EvalEvent): Action {
    const deal = getDeal(this.allLicenseDeals, event.licenses.map(l => l.addonLicenseId));
    const latestLicense = event.licenses[event.licenses.length - 1];
    if (deal) {
      return {
        type: 'update',
        deal,
        properties: {
          dealUpdateProperties(deal, latestLicense),
        },
      };
    }
    else {
      return {
        type: 'create',
        properties: {
          dealstage: DealStage.EVAL,
          ...dealCreationPropertiesFromLicense(latestLicense),
        },
      };
    }
  }

  private actionForPurchase(event: PurchaseEvent): Action | null {
    const deal = (
      // Either it is an eval or a purchase without a transaction,
      getDeal(this.allLicenseDeals, event.licenses.map(l => l.addonLicenseId)) ||
      // or it exists with a transaction
      getDeal(this.allTransactionDeals, event.transaction
        ? [event.transaction.transactionId]
        : [])
    );

    const record = getLatestRecord(event);
    if (!deal) {
      return this.createPurchaseDeal(record);
    }
    else if (deal.properties.dealstage === DealStage.EVAL) {
      return this.transitionToPurchased(deal, record);
    }
    else {
      return null;
    }
  }

  private actionForRenewal(event: RenewalEvent | UpgradeEvent): Action {
    return {
      type: 'create',
      properties: {
        dealstage: DealStage.EVAL,
        ...dealCreationPropertiesFromTransaction(event.transaction),
      },
    };
  }

  private actionForRefund(event: RefundEvent): Action | null {
    // event.refundedTxs
    const deals = getDeals(this.allTransactionDeals, event.refundedTxs.map(tx => tx.transactionId));
    return (deals
      // filter to non-closed
      // create update (set closed-lost)
      // in update, also specify close-date if needed
    );
  }

}

function getDeal(dealMap: Map<string, Deal>, ids: string[]) {
  return getDeals(dealMap, ids).find(deal => deal);
}

function getDeals(dealMap: Map<string, Deal>, ids: string[]) {
  return (ids
    .map(id => dealMap.get(id))
    .filter(isPresent));
}

type Action = (
  { type: 'update', deal: Deal, properties: Partial<Deal['properties']> } |
  { type: 'create', properties: Deal['properties'] }
);

function actionForOutcome(outcome: Outcome, event: DealRelevantEvent, deal: Deal | undefined): Action {
  switch (outcome.type) {
    case 'create':
      return {
        type: 'create',
        properties: {
          ...dealPropertiesForEvent(event),
          dealstage: outcome.stage,
        }
      };
    case 'update':
      assert.ok(deal);
      return {
        type: 'update',
        deal,
        properties: dealUpdatePropertiesForEvent(event, deal),
      };
    case 'close':
      assert.ok(deal);
      return {
        type: 'update',
        deal,
        properties: {
          dealstage: outcome.stage,
        },
      };
  }
}

function dealPropertiesForEvent(event: DealRelevantEvent): Omit<Deal['properties'], 'dealstage'> {
  return {};
  // throw new Error('Function not implemented.');
}

function dealUpdatePropertiesForEvent(event: DealRelevantEvent, deal: Deal): Partial<Deal['properties']> {
  return {};
  // throw new Error('Function not implemented.');
}
