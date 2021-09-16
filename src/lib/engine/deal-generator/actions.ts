import assert from 'assert';
import { DealStage } from '../../util/config.js';
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
    const deal = getDeal(this.allLicenseDeals, event.licenseIds);
    const latestLicenseId = event.licenseIds[event.licenseIds.length - 1];
    const license = this.getLicense(latestLicenseId);
    if (deal) {
      return {
        type: 'update',
        deal,
        properties: {
          dealUpdateProperties(deal, license),
        },
      };
    }
    else {
      return {
        type: 'create',
        properties: {
          dealstage: DealStage.EVAL,
          ...dealCreationPropertiesFromLicense(license),
        },
      };
    }
  }

  private actionForPurchase(event: PurchaseEvent): Action | null {
    const deal = (
      // Either it is an eval or a purchase without a transaction,
      getDeal(this.allLicenseDeals, event.licenseIds) ||
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
    return null;
  }

  private getLicense(latestLicenseId: string): License {
    throw new Error('Method not implemented.');
  }

}

export function abbrEventDetails(e: DealRelevantEvent) {
  switch (e.type) {
    case 'eval': return { type: e.type, id: e.licenseIds };
    case 'purchase': return { type: e.type, id: e.licenseIds, tx: e.transaction?.transactionId };
    case 'refund': return { type: e.type, id: e.refundedTxIds[0] };
    case 'renewal': return { type: e.type, id: e.transaction.transactionId };
    case 'upgrade': return { type: e.type, id: e.transaction.transactionId };
  }
}

function getDeal(dealMap: Map<string, Deal>, ids: string[]) {
  for (const id of ids) {
    const deal = dealMap.get(id);
    if (deal) return deal;
  }
  return null;
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
