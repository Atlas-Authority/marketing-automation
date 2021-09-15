import assert from 'assert';
import { isPresent } from "../../util/helpers.js";
import logger from "../../util/logger.js";
import { decisionMatrix, Outcome } from "./decision-matrix.js";
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
    const actions: Action[] = [];

    for (const event of events) {
      let action: Action | null = null;
      const reasons = new Set<string>();

      for (const [checkHosting, checkEvent, checkState, outcome] of decisionMatrix) {
        const hosting = groups[0].license.hosting;
        if (!checkHosting(hosting)) {
          reasons.add(`hosting = ${hosting}`);
          continue;
        }

        if (!checkEvent(event.type)) {
          reasons.add(`event = ${event.type}`);
          continue;
        }

        const state = this.getState(event);
        const [passed, deal] = checkState(state);
        if (!passed) {
          reasons.add(`all deals = ${state.map(d => d.id).join(', ')}`);
          reasons.add(`found deal = ${deal?.id}`);
          continue;
        }

        action = actionForOutcome(outcome, event, deal);
        break;
      }

      if (action) {
        logger.verbose('Deal Actions', 'Pushing action', action);
        actions.push(action);
      }
      else {
        logger.verbose('Deal Actions', 'No action path for event', {
          event: abbrEventDetails(event),
          reasons,
        });
      }
    }

    return actions;
  }

  private getState(event: DealRelevantEvent) {
    switch (event.type) {
      case 'eval':
        // There's only 0-1 evals
        return getDeals(this.allLicenseDeals, event.licenseIds);
      case 'purchase':
        // There is either: nothing, 1 eval, or 1+ closeds
        // The purchases may have either license or transaction ids
        return [
          ...getDeals(this.allLicenseDeals, event.licenseIds),
          ...getDeals(this.allTransactionDeals,
            event.transaction
              ? [event.transaction.transactionId]
              : [])
        ];
      case 'refund':
        // May have 1+ closeds, or 1 eval, or nothing (e.g. all are new events)
        return getDeals(this.allTransactionDeals, event.refundedTxIds);
      case 'renewal':
      case 'upgrade':
        // May have 1+ closeds, or 1 eval, or nothing (e.g. all are new events)
        return getDeals(this.allTransactionDeals, [event.transaction.transactionId]);
    }
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
  throw new Error('Function not implemented.');
}

function dealUpdatePropertiesForEvent(event: DealRelevantEvent, deal: Deal): Partial<Deal['properties']> {
  throw new Error('Function not implemented.');
}
