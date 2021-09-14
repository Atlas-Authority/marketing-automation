import { DealStage } from "../../util/config.js";
import { DealRelevantEvent } from "./events.js";

const hosting = {
  isServer: (hosting: 'Server' | 'Data Center' | 'Cloud') => hosting === 'Server',
  isDataCenter: (hosting: 'Server' | 'Data Center' | 'Cloud') => hosting === 'Data Center',
  isCloud: (hosting: 'Server' | 'Data Center' | 'Cloud') => hosting === 'Cloud',
  isAny: (_hosting: 'Server' | 'Data Center' | 'Cloud') => true,
};

const event = {
  isNewTrial: (type: DealRelevantEvent['type']) => type === 'eval',
  isPurchase: (type: DealRelevantEvent['type']) => type === 'purchase',
  isaRenewal: (type: DealRelevantEvent['type']) => type === 'renewal',
  isUpgraded: (type: DealRelevantEvent['type']) => type === 'upgrade',
  isRefunded: (type: DealRelevantEvent['type']) => type === 'refund',
};

const state = {
  hasNothing: (deals: Deal[]) => deals.length === 0,
  hasTrial: (deals: Deal[]) => deals.some(d => d.properties.dealstage === DealStage.EVAL),
  any: (_deals: Deal[]) => true,
};

const outcome = {
  createTrial: (event: DealRelevantEvent, deal: Deal | null) => null,
  updateCloseDate: (event: DealRelevantEvent, deal: Deal | null) => null,
  createWon: (event: DealRelevantEvent, deal: Deal | null) => null,
  closeWon: (event: DealRelevantEvent, deal: Deal | null) => null,
  closeLost: (event: DealRelevantEvent, deal: Deal | null) => null,
};

type DecisionMatrix = [
  (hosting: 'Server' | 'Data Center' | 'Cloud') => boolean,
  (type: DealRelevantEvent['type']) => boolean,
  (deals: Deal[]) => boolean,
  (event: DealRelevantEvent, deal: Deal | null) => unknown,
][];

export const decisionMatrix: DecisionMatrix = [
  [hosting.isServer, event.isNewTrial, state.hasNothing, outcome.createTrial],
  [hosting.isServer, event.isNewTrial, state.hasTrial, outcome.updateCloseDate],
  [hosting.isServer, event.isPurchase, state.hasNothing, outcome.createWon],
  [hosting.isServer, event.isPurchase, state.hasTrial, outcome.closeWon],
  [hosting.isServer, event.isaRenewal, state.any, outcome.createWon],
  [hosting.isServer, event.isUpgraded, state.any, outcome.createWon],

  [hosting.isDataCenter, event.isNewTrial, state.hasNothing, outcome.createTrial],
  [hosting.isDataCenter, event.isNewTrial, state.hasTrial, outcome.updateCloseDate],
  [hosting.isDataCenter, event.isPurchase, state.hasNothing, outcome.createWon],
  [hosting.isDataCenter, event.isPurchase, state.hasTrial, outcome.closeWon],
  [hosting.isDataCenter, event.isaRenewal, state.any, outcome.createWon],
  [hosting.isDataCenter, event.isUpgraded, state.any, outcome.createWon],

  [hosting.isCloud, event.isNewTrial, state.hasNothing, outcome.createTrial],
  [hosting.isCloud, event.isPurchase, state.hasTrial, outcome.closeWon],
  [hosting.isCloud, event.isPurchase, state.hasNothing, outcome.createWon],
  [hosting.isCloud, event.isaRenewal, state.any, outcome.createWon],
  [hosting.isCloud, event.isUpgraded, state.any, outcome.createWon],

  [hosting.isAny, event.isRefunded, state.any, outcome.closeLost],
];
