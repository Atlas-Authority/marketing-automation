import { DealStage } from '../../util/config.js';
import { isPresent, sorter } from '../../util/helpers.js';
import { DealRelevantEvent, EvalEvent, PurchaseEvent, RefundEvent, RenewalEvent, UpgradeEvent } from "./events.js";
import { getDate, isLicense } from './records.js';

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
      // or it exists as a purchase with a transaction
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
        return makeUpdateAction(deal, null, { dealstage: DealStage.CLOSED_LOST })
      })
    );
  }

}

type Action = (
  { type: 'update', deal: Deal, properties: Partial<Deal['properties']> } |
  { type: 'create', properties: Deal['properties'] }
);

function makeCreateAction(record: License | Transaction, dealstage: DealStage): Action {
  return {
    type: 'create',
    properties: isLicense(record)
      ? dealCreationPropertiesFromLicense(record, dealstage)
      : dealCreationPropertiesFromTransaction(record, dealstage),
  };
}

function makeUpdateAction(deal: Deal, record: License | Transaction | null, properties: Partial<Deal['properties']>): Action {
  if (record) {
    properties = {
      ...properties,
      ...(isLicense(record)
        ? dealUpdatePropertiesForLicense(deal, record)
        : dealUpdatePropertiesForTransaction(deal, record)
      )
    };
  }
  return { type: 'update', deal, properties };
}

function getLatestRecord(event: PurchaseEvent): License | Transaction {
  const records: (License | Transaction)[] = [...event.licenses];
  if (event.transaction) records.push(event.transaction);
  return records.sort(sorter(getDate, 'DSC'))[0];
}

function dealCreationPropertiesFromLicense(record: License, dealstage: string): { aa_app: string; addonlicenseid: string; transactionid: string; closedate: string; country: string; dealname: string; deployment: string; license_tier: string; origin: string; related_products: string; pipeline: string; dealstage: string; amount: string; } {
  throw new Error('Function not implemented.');
}

function dealCreationPropertiesFromTransaction(record: Transaction, dealstage: string): { aa_app: string; addonlicenseid: string; transactionid: string; closedate: string; country: string; dealname: string; deployment: string; license_tier: string; origin: string; related_products: string; pipeline: string; dealstage: string; amount: string; } {
  throw new Error('Function not implemented.');
}

function dealUpdatePropertiesForLicense(deal: Deal, record: License): Partial<{ aa_app: string; addonlicenseid: string; transactionid: string; closedate: string; country: string; dealname: string; deployment: string; license_tier: string; origin: string; related_products: string; pipeline: string; dealstage: string; amount: string; }> {
  throw new Error('Function not implemented.');
}

function dealUpdatePropertiesForTransaction(deal: Deal, record: Transaction): Partial<{ aa_app: string; addonlicenseid: string; transactionid: string; closedate: string; country: string; dealname: string; deployment: string; license_tier: string; origin: string; related_products: string; pipeline: string; dealstage: string; amount: string; }> {
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
