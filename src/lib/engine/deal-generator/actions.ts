import mustache from 'mustache';
import log from "../../log/logger";
import { Deal, DealData, DealManager } from "../../model/deal";
import { DealStage, Pipeline } from "../../model/hubspot/interfaces";
import { License } from "../../model/license";
import { Transaction } from "../../model/transaction";
import env from '../../parameters/env-config';
import { isPresent, sorter } from "../../util/helpers";
import { abbrEventDetails, DealRelevantEvent, EvalEvent, EventMeta, PurchaseEvent, RefundEvent, RenewalEvent, UpgradeEvent } from "./events";

type DealNoOpReason = Exclude<EventMeta, null> | 'properties-up-to-date';

export type Action = CreateDealAction | UpdateDealAction | IgnoreDealAction;
export type CreateDealAction = { type: 'create'; properties: DealData };
export type UpdateDealAction = { type: 'update'; deal: Deal; properties: Partial<DealData> };
export type IgnoreDealAction = { type: 'noop'; deal: Deal | null, reason: DealNoOpReason };

export class ActionGenerator {

  #handledDeals = new Map<Deal, DealRelevantEvent>();
  public constructor(
    private dealManager: DealManager,
    private ignore: (reason: string, amount: number) => void,
  ) { }

  public generateFrom(records: (License | Transaction)[], events: DealRelevantEvent[]) {
    return events.flatMap(event => this.actionsFor(records, event));
  }

  private actionsFor(records: (License | Transaction)[], event: DealRelevantEvent): Action[] {
    switch (event.type) {
      case 'eval': return [this.actionForEval(records, event)];
      case 'purchase': return [this.actionForPurchase(records, event)];
      case 'renewal': return [this.actionForRenewal(records, event)];
      case 'upgrade': return [this.actionForRenewal(records, event)];
      case 'refund': return this.actionsForRefund(records, event);
    }
  }

  private actionForEval(records: (License | Transaction)[], event: EvalEvent): Action {
    const deal = this.singleDeal(this.dealManager.getDealsForRecords(event.licenses));
    if (deal) this.recordSeen(deal, event);

    const metaAction = this.maybeMakeMetaAction(event, deal, 0);
    if (metaAction) return metaAction;

    const latestLicense = event.licenses[event.licenses.length - 1];
    if (!deal) {
      const dealStage = (event.licenses.some(l => l.active)
        ? DealStage.EVAL
        : DealStage.CLOSED_LOST);
      return makeCreateAction(records, latestLicense, dealStage);
    }
    else if (deal.isEval()) {
      const dealStage = (event.licenses.some(l => l.active)
        ? DealStage.EVAL
        : DealStage.CLOSED_LOST);
      return makeUpdateAction(records, deal, latestLicense, dealStage);
    }
    else {
      return makeUpdateAction(records, deal, latestLicense);
    }
  }

  private actionForPurchase(records: (License | Transaction)[], event: PurchaseEvent): Action {
    const recordsToSearch = [event.transaction, ...event.licenses].filter(isPresent);
    const deal = this.singleDeal(this.dealManager.getDealsForRecords(recordsToSearch));
    if (deal) this.recordSeen(deal, event);

    const metaAction = this.maybeMakeMetaAction(event, deal, event.transaction?.data.vendorAmount ?? 0);
    if (metaAction) return metaAction;

    if (deal) {
      const record = event.transaction || getLatestLicense(event);
      const dealStage = (event.transaction?.refunded
        ? DealStage.CLOSED_LOST
        : DealStage.CLOSED_WON);
      return makeUpdateAction(records, deal, record, dealStage);
    }
    else if (event.transaction) {
      return makeCreateAction(records, event.transaction, DealStage.CLOSED_WON);
    }
    else {
      const license = getLatestLicense(event);
      return makeCreateAction(records, license, DealStage.CLOSED_WON);
    }
  }

  private actionForRenewal(records: (License | Transaction)[], event: RenewalEvent | UpgradeEvent): Action {
    const deal = this.singleDeal(this.dealManager.getDealsForRecords([event.transaction]));
    if (deal) this.recordSeen(deal, event);

    const metaAction = this.maybeMakeMetaAction(event, deal, event.transaction.data.vendorAmount);
    if (metaAction) return metaAction;

    if (deal) {
      return makeUpdateAction(records, deal, event.transaction);
    }
    return makeCreateAction(records, event.transaction, DealStage.CLOSED_WON);
  }

  private actionsForRefund(records: (License | Transaction)[], event: RefundEvent): Action[] {
    const deals = this.dealManager.getDealsForRecords(event.refundedTxs);
    for (const deal of deals) {
      this.recordSeen(deal, event);
    }

    return ([...deals]
      .map(deal => makeUpdateAction(records, deal, null, DealStage.CLOSED_LOST, { amount: 0 }))
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

  maybeMakeMetaAction(event: Exclude<DealRelevantEvent, RefundEvent>, deal: Deal | null, amount: number): Action | null {
    switch (event.meta) {
      case 'archived-app':
      case 'mass-provider-only':
        const reason = (event.meta === 'archived-app'
          ? 'Archived-app transaction'
          : 'Mass-provider transaction'
        );
        if (!deal) {
          this.ignore(reason, amount);
        }
        return { type: 'noop', deal, reason: event.meta };
      default:
        return null;
    }
  }

}

function makeCreateAction(records: (License | Transaction)[], record: License | Transaction, dealStage: DealStage): Action {
  return {
    type: 'create',
    properties: dealCreationProperties(records, record, dealStage),
  };
}

function makeUpdateAction(records: (License | Transaction)[], deal: Deal, record: License | Transaction | null, dealStage?: DealStage, certainData?: Partial<DealData>): Action {
  if (dealStage !== undefined) deal.data.dealStage = dealStage;
  if (record) {
    Object.assign(deal.data, dealCreationProperties(records, record, dealStage ?? deal.data.dealStage));
    deal.data.licenseTier = Math.max(deal.data.licenseTier ?? -1, record.tier);
  }

  if (certainData) {
    Object.assign(deal.data, certainData);
  }

  if (!deal.hasPropertyChanges()) {
    return { type: 'noop', deal, reason: 'properties-up-to-date' };
  }

  return {
    type: 'update',
    deal,
    properties: deal.getPropertyChanges(),
  };
}

function getLatestLicense(event: PurchaseEvent): License {
  return [...event.licenses].sort(sorter(item => item.data.maintenanceStartDate, 'DSC'))[0];
}

function dealCreationProperties(records: (License | Transaction)[], record: License | Transaction, dealStage: DealStage): DealData {
  /**
   * If any record in any of the deal's groups have partner contacts
   * then use the most recent record's partner contact's domain.
   * Otherwise set this to null.
   */
  const associatedPartner = ([...records]
    .reverse()
    .map(record => record.partnerDomain)
    .find(domain => domain)
    ?? null);

  return {
    closeDate: (record instanceof Transaction
      ? record.data.saleDate
      : record.data.maintenanceStartDate),
    deployment: record.data.hosting,
    app: record.data.addonKey,
    licenseTier: record.tier,
    country: record.data.country,
    origin: env.hubspot.deals.dealOrigin ?? null,
    relatedProducts: env.hubspot.deals.dealRelatedProducts ?? null,
    dealName: mustache.render(env.hubspot.deals.dealDealName, record.data),
    pipeline: Pipeline.MPAC,
    associatedPartner,
    addonLicenseId: record.data.addonLicenseId,
    transactionId: (record instanceof Transaction ? record.data.transactionId : null),
    appEntitlementId: record.data.appEntitlementId,
    appEntitlementNumber: record.data.appEntitlementNumber,
    dealStage,
    amount: (dealStage === DealStage.EVAL
      ? null
      : record instanceof License
        ? 0
        : record.data.vendorAmount),
  };
}
