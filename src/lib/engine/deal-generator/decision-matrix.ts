import { DealStage } from "../../util/config.js";
import { DealRelevantEvent } from "./events.js";

const hosting = {
  isServer: (groups: RelatedLicenseSet) => getHosting(groups) === 'Server',
  isDataCenter: (groups: RelatedLicenseSet) => getHosting(groups) === 'Data Center',
  isCloud: (groups: RelatedLicenseSet) => getHosting(groups) === 'Cloud',
  isAny: (_groups: RelatedLicenseSet) => true,
};

const event = {
  isNewTrial: (event: DealRelevantEvent) => event.type === 'eval',
  isPurchase: (event: DealRelevantEvent) => event.type === 'purchase',
  isaRenewal: (event: DealRelevantEvent) => event.type === 'renewal',
  isUpgraded: (event: DealRelevantEvent) => event.type === 'upgrade',
  isRefunded: (event: DealRelevantEvent) => event.type === 'refund',
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
  (groups: RelatedLicenseSet) => boolean,
  (event: DealRelevantEvent) => boolean,
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

function getHosting(groups: RelatedLicenseSet) {
  return groups[0].license.hosting;
}
