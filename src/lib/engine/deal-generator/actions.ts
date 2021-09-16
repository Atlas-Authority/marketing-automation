import assert from 'assert';
import { DealStage } from '../../util/config.js';
import { isPresent } from '../../util/helpers.js';
import { Outcome } from "./decision-matrix.js";
import { DealRelevantEvent, EvalEvent, PurchaseEvent, RefundEvent, RenewalEvent, UpgradeEvent } from "./events.js";

export class ActionGenerator {

  licenseDealFinder: DealFinder;
  transactionDealFinder: DealFinder;

  constructor(initialDeals: Deal[]) {
    this.licenseDealFinder = new DealFinder(initialDeals, deal => deal.properties.addonlicenseid);
    this.transactionDealFinder = new DealFinder(initialDeals, deal => deal.properties.transactionid);
  }

  generateFrom(events: DealRelevantEvent[]) {
    return events.flatMap(event => this.actionsFor(event));
  }

  private actionsFor(event: DealRelevantEvent): Action[] {
    switch (event.type) {
      case 'eval': return [this.actionForEval(event)];
      case 'purchase': {
        const action = this.actionForPurchase(event);
        return action ? [action] : [];
      }
      case 'renewal': return [this.actionForRenewal(event)];
      case 'upgrade': return [this.actionForRenewal(event)];
      case 'refund': return this.actionForRefund(event);
    }
  }

  private actionForEval(event: EvalEvent): Action {
    const deal = this.licenseDealFinder.getDeal(event.licenses);
    const latestLicense = event.licenses[event.licenses.length - 1];
    if (deal) {
      // makeUpdateEvent(deal, latestLicense)
      return {
        type: 'update',
        deal,
        properties: {
          dealUpdateProperties(deal, latestLicense),
        },
      };
    }
    else {
      // makeCreateEvent(latestLicense, {dealstage: DealStage.EVAL})
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
      this.licenseDealFinder.getDeal(event.licenses) ||
      // or it exists with a transaction
      this.transactionDealFinder.getDeal(event.transaction
        ? [event.transaction]
        : [])
    );

    const record = getLatestRecord(event);
    if (!deal) {
      // makeCreateEvent(licenseOrTransaction, {dealstage: DealStage.CLOSED_WON})
      return this.createPurchaseDeal(record);
    }
    else if (deal.properties.dealstage === DealStage.EVAL) {
      // makeUpdateEvent(licenseOrTransaction, {dealstage: DealStage.CLOSED_WON})
      return this.transitionToPurchased(deal, record);
    }
    else {
      return null;
    }
  }

  private actionForRenewal(event: RenewalEvent | UpgradeEvent): Action {
    // makeCreateEvent(transaction, {dealstage: DealStage.CLOSED_WON})
    return {
      type: 'create',
      properties: {
        dealstage: DealStage.EVAL,
        ...dealCreationPropertiesFromTransaction(event.transaction),
      },
    };
  }

  private actionForRefund(event: RefundEvent): Action[] {
    // event.refundedTxs
    const deals = this.transactionDealFinder.getDeals(event.refundedTxs);
    // makeUpdateEvent(transaction, {dealstage: DealStage.CLOSED_LOST})
    return (deals
      .filter(deal => deal.properties.dealstage !== DealStage.CLOSED_LOST)
      .map(deal => {
        return {
          type: 'update',
          properties: {
            dealstage: DealStage.CLOSED_LOST,
            // also specify close-date if needed
          },
        } as Action;
      })
    );
  }

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

class DealFinder {

  deals = new Map<string, Deal>();

  constructor(initialDeals: Deal[], keyfn: (deal: Deal) => string) {
    for (const deal of initialDeals) {
      const key = keyfn(deal);
      if (key) this.deals.set(key, deal);
    }
  }

  getDeal(records: (License | Transaction)[]) {
    return this.getDeals(records).find(deal => deal);
  }

  getDeals(records: (License | Transaction)[]) {
    return (records
      .map(record => this.deals.get(this.idFor(record)))
      .filter(isPresent));
  }

  idFor(record: License | Transaction): string {
    return ('transactionId' in record
      ? record.transactionId
      : record.addonLicenseId);
  }

}
