import { DealStage } from '../../util/config.js';
import { isPresent } from '../../util/helpers.js';
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
      case 'eval': {
        const action = this.actionForEval(event);
        return action ? [action] : [];
      }
      case 'purchase': {
        const action = this.actionForPurchase(event);
        return action ? [action] : [];
      }
      case 'renewal': return [this.actionForRenewal(event)];
      case 'upgrade': return [this.actionForRenewal(event)];
      case 'refund': return this.actionForRefund(event);
    }
  }

  private actionForEval(event: EvalEvent): Action | null {
    const deal = this.licenseDealFinder.getDeal(event.licenses);
    const latestLicense = event.licenses[event.licenses.length - 1];
    if (!deal) {
      return makeCreateAction(latestLicense, DealStage.EVAL);
    }
    else if (deal.properties.dealstage === DealStage.EVAL) {
      return makeUpdateAction(deal, latestLicense, {});
    }
    else {
      return null;
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
      return makeCreateAction(record, DealStage.CLOSED_WON);
    }
    else if (deal.properties.dealstage === DealStage.EVAL) {
      return makeUpdateAction(deal, record, { dealstage: DealStage.CLOSED_WON });
    }
    else {
      return null;
    }
  }

  private actionForRenewal(event: RenewalEvent | UpgradeEvent): Action {
    return makeCreateAction(event.transaction, DealStage.CLOSED_WON);
  }

  private actionForRefund(event: RefundEvent): Action[] {
    const deals = this.transactionDealFinder.getDeals(event.refundedTxs);
    return (deals
      .filter(deal => deal.properties.dealstage !== DealStage.CLOSED_LOST)
      .map(deal => {
        return makeUpdateAction(deal, transaction, { dealstage: DealStage.CLOSED_LOST })
      })
    );
  }

}

type Action = (
  { type: 'update', deal: Deal, properties: Partial<Deal['properties']> } |
  { type: 'create', properties: Deal['properties'] }
);

function makeCreateAction(record: License | Transaction, dealStage: DealStage): Action {
  // return {
  //   type: 'create',
  //   properties: {
  //     dealstage: DealStage.EVAL,
  //     ...dealCreationPropertiesFromLicense(latestLicense),
  //   },
  // };
  // return {
  //   type: 'create',
  //   properties: {
  //     dealstage: DealStage.CLOSED_WON,
  //     ...dealCreationPropertiesFromTransaction(event.transaction),
  //   },
  // };
  throw new Error('Function not implemented.');
}

function makeUpdateAction(deal: Deal, record: License | Transaction, properties: Partial<Deal['properties']>): Action {
  // return {
  //   type: 'update',
  //   deal,
  //   properties: {
  //     dealUpdateProperties(deal, latestLicense),
  //   },
  // };
  // return {
  //   type: 'update',
  //   properties: {
  //     dealstage: DealStage.CLOSED_LOST,
  //     // also specify close-date if needed
  //   },
  // } as Action;
  throw new Error('Function not implemented.');
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
