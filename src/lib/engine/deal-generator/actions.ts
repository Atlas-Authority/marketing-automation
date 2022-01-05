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

  public generateFrom(events: DealRelevantEvent[]) {
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

    const metaAction = this.maybeMakeMetaAction(event, deal, 0);
    if (metaAction) return metaAction;

    const latestLicense = event.licenses[event.licenses.length - 1];
    if (!deal) {
      return makeCreateAction(latestLicense, {
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
      return makeUpdateAction(deal, latestLicense, dealStage);
    }
    else {
      return makeUpdateAction(deal, latestLicense);
    }
  }

  private actionForPurchase(event: PurchaseEvent): Action {
    const recordsToSearch = [event.transaction, ...event.licenses].filter(isPresent);
    const deal = this.singleDeal(this.dealManager.getDealsForRecords(recordsToSearch));
    if (deal) this.recordSeen(deal, event);

    const metaAction = this.maybeMakeMetaAction(event, deal, event.transaction?.data.vendorAmount ?? 0);
    if (metaAction) return metaAction;

    if (deal) {
      const record = event.transaction || getLatestLicense(event);
      const dealStage = deal.isEval() ? DealStage.CLOSED_WON : deal.data.dealStage;
      return makeUpdateAction(deal, record, dealStage);
    }
    else if (event.transaction) {
      return makeCreateAction(event.transaction, {
        dealStage: DealStage.CLOSED_WON,
        addonLicenseId: event.transaction.data.addonLicenseId,
        transactionId: event.transaction.data.transactionId,
      });
    }
    else {
      const license = getLatestLicense(event);
      return makeCreateAction(license, {
        dealStage: DealStage.CLOSED_WON,
        addonLicenseId: license.data.addonLicenseId,
        transactionId: null,
      });
    }
  }

  private actionForRenewal(event: RenewalEvent | UpgradeEvent): Action {
    const deal = this.singleDeal(this.dealManager.getDealsForRecords([event.transaction]));
    if (deal) this.recordSeen(deal, event);

    const metaAction = this.maybeMakeMetaAction(event, deal, event.transaction.data.vendorAmount);
    if (metaAction) return metaAction;

    if (deal) {
      return makeUpdateAction(deal, event.transaction);
    }
    return makeCreateAction(event.transaction, {
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
      .map(deal => makeUpdateAction(deal, null, DealStage.CLOSED_LOST, { amount: 0 }))
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

function makeCreateAction(record: License | Transaction, data: Pick<DealData, 'addonLicenseId' | 'transactionId' | 'dealStage'>): Action {
  return {
    type: 'create',
    properties: dealCreationProperties(record, data),
  };
}

function makeUpdateAction(deal: Deal, record: License | Transaction | null, dealstage?: DealStage, certainData?: Partial<DealData>): Action {
  if (dealstage !== undefined) deal.data.dealStage = dealstage;
  if (record) {
    const dataToEnsure = {
      addonLicenseId: deal.data.addonLicenseId,
      transactionId: deal.data.transactionId,
      dealStage: deal.data.dealStage,
    };
    if (record instanceof Transaction) {
      dataToEnsure.transactionId = record.data.transactionId;
      dataToEnsure.addonLicenseId = record.data.addonLicenseId;
    }
    Object.assign(deal.data, dealCreationProperties(record, dataToEnsure));
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

function dealCreationProperties(record: License | Transaction, data: Pick<DealData, 'addonLicenseId' | 'transactionId' | 'dealStage'>): DealData {
  return {
    ...data,
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
    associatedPartner: null,
    amount: (data.dealStage === DealStage.EVAL
      ? null
      : record instanceof License
        ? 0
        : record.data.vendorAmount),
  };
}
