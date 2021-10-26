import { DealStage } from '../../config/index.js';
import log from '../../log/logger.js';
import { Deal, DealData, DealManager } from '../../model/deal.js';
import { License } from '../../model/license.js';
import { Transaction } from '../../model/transaction.js';
import { isPresent, sorter } from '../../util/helpers.js';
import { RelatedLicenseSet } from '../license-matching/license-grouper.js';
import { DealRelevantEvent, EvalEvent, PurchaseEvent, RefundEvent, RenewalEvent, UpgradeEvent } from "./events.js";
import { dealCreationProperties, updateDeal } from './records.js';

export class ActionGenerator {

  duplicatesToDelete = new Set<string>();

  constructor(private dealManager: DealManager) { }

  generateFrom(events: DealRelevantEvent[]) {
    return events.flatMap(event => this.actionsFor(event, events));
  }

  private actionsFor(event: DealRelevantEvent, events: DealRelevantEvent[]): Action[] {
    switch (event.type) {
      case 'eval': return [this.actionForEval(event, this.dealFor(events))];
      case 'purchase': return [this.actionForPurchase(event, this.dealFor(events))];
      case 'renewal': return [this.actionForRenewal(event, this.dealFor(events))];
      case 'upgrade': return [this.actionForRenewal(event, this.dealFor(events))];
      case 'refund': return this.actionsForRefund(event);
    }
  }

  private actionForEval(event: EvalEvent, deal: Deal | null): Action {
    const latestLicense = event.licenses[event.licenses.length - 1];
    if (!deal) {
      return makeCreateAction(event, latestLicense,
        latestLicense.active
          ? DealStage.EVAL
          : DealStage.CLOSED_LOST);
    }
    else if (deal.isEval()) {
      return makeUpdateAction(event, deal, latestLicense);
    }
    else {
      return makeIgnoreAction(event, deal, 'Deal already exists and is not eval');
    }
  }

  private actionForPurchase(event: PurchaseEvent, deal: Deal | null): Action {
    const record = getLatestRecord(event);
    if (!deal) {
      return makeCreateAction(event, record, DealStage.CLOSED_WON);
    }
    else if (deal.isEval()) {
      return makeUpdateAction(event, deal, record, DealStage.CLOSED_WON);
    }
    else {
      return makeIgnoreAction(event, deal, 'Deal already exists and is not eval');
    }
  }

  private actionForRenewal(event: RenewalEvent | UpgradeEvent, deal: Deal | null): Action {
    if (deal) {
      return makeIgnoreAction(event, deal, 'Deal already exists for this transaction');
    }
    return makeCreateAction(event, event.transaction, DealStage.CLOSED_WON);
  }

  private actionsForRefund(event: RefundEvent): Action[] {
    const deals = this.dealManager.getDealsForRecords(event.refundedTxs);
    return ([...deals]
      .filter(deal => deal.data.dealstage !== DealStage.CLOSED_LOST)
      .map(deal => makeUpdateAction(event, deal, null, DealStage.CLOSED_LOST))
      .filter(isPresent)
    );
  }

  private dealFor(events: DealRelevantEvent[]) {
    let dealToUse = null;

    const groups = events.flatMap(e => e.groups);
    const records = groups.flatMap(g => [g.license, ...g.transactions]);
    const foundDeals = this.dealManager.getDealsForRecords(records);

    if (foundDeals.size === 1) {
      [dealToUse] = foundDeals;
    }
    else if (foundDeals.size > 1) {
      // Has duplicates!

      const importantDeals = [...foundDeals].filter(d =>
        d.data.hasEngagement || d.data.hasOwner);

      let toDelete = [];

      if (importantDeals.length === 0) {
        // Just pick one, it'll be updated soon; delete the rest
        [dealToUse, ...toDelete] = foundDeals;
      }
      else {
        // Pick one, keep/report the other importants; delete the rest
        dealToUse = importantDeals[0];

        if (importantDeals.length > 1) {
          log.warn('Deal Generator',
            `Found duplicates that can't be auto-deleted.`,
            importantDeals.map(d => ({ id: d.id, ...d.data })));
        }

        for (const deal of foundDeals) {
          if (!importantDeals.includes(deal)) {
            toDelete.push(deal);
          }
        }
      }

      for (const deal of toDelete) {
        if (deal.id) {
          this.duplicatesToDelete.add(deal.id);
        }
      }
    }

    return dealToUse;
  }

}

export type CreateDealAction = {
  type: 'create';
  groups: RelatedLicenseSet;
  properties: DealData;
};

export type UpdateDealAction = {
  type: 'update';
  groups: RelatedLicenseSet;
  deal: Deal;
  properties: Partial<DealData>;
};

export type IgnoreDealAction = {
  type: 'ignore';
  groups: RelatedLicenseSet;
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

function makeUpdateAction(event: DealRelevantEvent, deal: Deal, record: License | Transaction | null, dealstage?: DealStage): Action {
  if (dealstage) deal.data.dealstage = dealstage;
  if (record) updateDeal(deal, record);

  if (!deal.hasPropertyChanges()) {
    return makeIgnoreAction(event, deal, 'No properties to update');
  }

  return {
    type: 'update',
    groups: event.groups,
    deal,
    properties: deal.getPropertyChanges(),
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
