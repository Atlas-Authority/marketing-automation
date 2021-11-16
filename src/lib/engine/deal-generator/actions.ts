import log from '../../log/logger.js';
import { Deal, DealData, DealManager } from '../../model/deal.js';
import { DealStage } from '../../model/hubspot/interfaces.js';
import { License } from '../../model/license.js';
import { Transaction } from '../../model/transaction.js';
import { isPresent, sorter } from '../../util/helpers.js';
import { RelatedLicenseSet } from '../license-matching/license-grouper.js';
import { abbrEventDetails, DealRelevantEvent, EvalEvent, PurchaseEvent, RefundEvent, RenewalEvent, UpgradeEvent } from "./events.js";
import { dealCreationProperties, updateDeal } from './records.js';

export class ActionGenerator {

  #handledDeals = new Map<Deal, DealRelevantEvent>();
  constructor(private dealManager: DealManager) { }

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
    const deal = this.singleDeal(this.dealManager.getDealsForRecords(event.licenses));
    if (deal) this.recordSeen(deal, event);

    const latestLicense = event.licenses[event.licenses.length - 1];
    if (!deal) {
      return makeCreateAction(event, latestLicense, {
        dealStage: event.licenses.some(l => l.active)
          ? DealStage.EVAL
          : DealStage.CLOSED_LOST,
        addonLicenseId: latestLicense.data.addonLicenseId,
        transactionId: null,
      });
    }
    else if (deal.isEval()) {
      const dealStage = (event.licenses.some(l => l.active)
        ? DealStage.EVAL
        : DealStage.CLOSED_LOST);
      return makeUpdateAction(event, deal, latestLicense, dealStage);
    }
    else {
      return makeUpdateAction(event, deal, latestLicense);
    }
  }

  private actionForPurchase(event: PurchaseEvent): Action {
    const recordsToSearch = [event.transaction, ...event.licenses].filter(isPresent);
    const deal = this.singleDeal(this.dealManager.getDealsForRecords(recordsToSearch));
    if (deal) this.recordSeen(deal, event);

    if (deal) {
      const license = event.transaction || getLatestLicense(event);
      return makeUpdateAction(event, deal, license, DealStage.CLOSED_WON);
    }
    else if (event.transaction) {
      return makeCreateAction(event, event.transaction, {
        dealStage: DealStage.CLOSED_WON,
        addonLicenseId: event.transaction.data.addonLicenseId,
        transactionId: event.transaction.data.transactionId,
      });
    }
    else {
      const license = getLatestLicense(event);
      return makeCreateAction(event, license, {
        dealStage: DealStage.CLOSED_WON,
        addonLicenseId: license.data.addonLicenseId,
        transactionId: null,
      });
    }
  }

  private actionForRenewal(event: RenewalEvent | UpgradeEvent): Action {
    const deal = this.singleDeal(this.dealManager.getDealsForRecords([event.transaction]));
    if (deal) this.recordSeen(deal, event);

    if (deal) {
      return makeUpdateAction(event, deal, event.transaction);
    }
    return makeCreateAction(event, event.transaction, {
      dealStage: DealStage.CLOSED_WON,
      addonLicenseId: event.transaction.data.addonLicenseId,
      transactionId: event.transaction.data.transactionId,
    });
  }

  private actionsForRefund(event: RefundEvent): Action[] {
    const deals = this.dealManager.getDealsForRecords(event.refundedTxs);
    for (const deal of deals) {
      this.recordSeen(deal, event);
    }

    return ([...deals]
      .filter(deal => deal.data.dealStage !== DealStage.CLOSED_LOST)
      .map(deal => makeUpdateAction(event, deal, null, DealStage.CLOSED_LOST))
      .filter(isPresent)
    );
  }

  private recordSeen(deal: Deal, event: DealRelevantEvent) {
    if (this.#handledDeals.has(deal)) {
      const existing = this.#handledDeals.get(deal);
      log.error('Deal Generator', 'Updating deal twice', {
        firstEvent: existing && abbrEventDetails(existing),
        currentEvent: abbrEventDetails(event),
        deal: {
          id: deal.id,
          data: deal.data,
        },
      });
    }
    else {
      this.#handledDeals.set(deal, event);
    }
  }

  private singleDeal(foundDeals: Set<Deal>) {
    let dealToUse = null;

    if (foundDeals.size === 1) {
      [dealToUse] = foundDeals;
    }
    else if (foundDeals.size > 1) {
      // Has duplicates!

      const importantDeals = [...foundDeals].filter(d => d.computed.hasActivity);

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

      this.dealManager.removeLocally(toDelete);
      for (const deal of toDelete) {
        let dupOf = this.dealManager.duplicatesToDelete.get(deal);
        if (!dupOf) this.dealManager.duplicatesToDelete.set(deal, dupOf = new Set());
        dupOf.add(dealToUse);
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

export type NoDealAction = {
  type: 'noop';
  deal: Deal;
};

export type Action = CreateDealAction | UpdateDealAction | NoDealAction;

export function abbrActionDetails(action: Action) {
  switch (action.type) {
    case 'create': return ['create', action.properties];
    case 'update': return ['update', action.deal.id, action.properties];
    case 'noop': return ['noop', action.deal.id];
  }
}

function makeCreateAction(event: DealRelevantEvent, record: License | Transaction, data: Pick<DealData, 'addonLicenseId' | 'transactionId' | 'dealStage'>): Action {
  return {
    type: 'create',
    groups: event.groups,
    properties: dealCreationProperties(record, data),
  };
}

function makeUpdateAction(event: DealRelevantEvent, deal: Deal, record: License | Transaction | null, dealstage?: DealStage): Action {
  if (dealstage !== undefined) deal.data.dealStage = dealstage;
  if (record) updateDeal(deal, record);

  if (!deal.hasPropertyChanges()) {
    log.detailed('Deal Actions', 'No properties to update for deal', deal.id);
    return { type: 'noop', deal };
  }

  return {
    type: 'update',
    groups: event.groups,
    deal,
    properties: deal.getPropertyChanges(),
  };
}

function getLatestLicense(event: PurchaseEvent): License {
  return [...event.licenses].sort(sorter(item => item.data.maintenanceStartDate, 'DSC'))[0];
}
