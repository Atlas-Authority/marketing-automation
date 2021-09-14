import * as logger from '../../util/logger.js';
import { isPresent } from "../../util/helpers.js";
import { decisionMatrix } from "./decision-matrix.js";
import { DealRelevantEvent } from "./events.js";

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

  generateFrom(events: DealRelevantEvent[], groups: RelatedLicenseSet) {
    const actions = [];

    for (const event of events) {
      let handled = false;

      for (const [checkHosting, checkEvent, checkState, runOutcome] of decisionMatrix) {
        if (!checkHosting(groups)) continue;
        if (!checkEvent(event)) continue;

        const state = this.getState(event);
        if (!checkState(state)) continue;

        const action = runOutcome(event, state[0]);
        actions.push(action);

        handled = true;
        break;
      }

      if (!handled) {
        logger.verbose('Deal Actions', 'No action path for event', abbrEventDetails(event));
      }
    }

    return actions;
  }

  private getState(event: DealRelevantEvent) {
    switch (event.type) {
      case 'eval':
        return this.getDeals(this.allLicenseDeals, event.licenseIds);
      case 'purchase':
        return [
          ...this.getDeals(this.allLicenseDeals, event.licenseIds),
          ...this.getDeals(this.allTransactionDeals,
            event.transaction
              ? [event.transaction.transactionId]
              : [])
        ];
      case 'refund':
        return this.getDeals(this.allTransactionDeals, event.refundedTxIds);
      case 'renewal':
      case 'upgrade':
        return this.getDeals(this.allTransactionDeals, [event.transaction.transactionId]);
    }
  }

  private getDeals(dealMap: Map<string, Deal>, ids: string[]) {
    return (ids
      .map(id => dealMap.get(id))
      .filter(isPresent));
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
