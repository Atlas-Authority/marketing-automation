import * as assert from 'assert';
import { LicenseContext } from '../../types/license.js';

export function calculateTierFromLicenseContext(ctx: LicenseContext) {
  return [
    tierFromEvalOpportunity(ctx.license.evaluationOpportunitySize),
    parseLicenseTier(ctx.license.tier),
    ...ctx.transactions.map(t => parseTransactionTier(t.purchaseDetails.tier)),
  ];
}

export function tierFromEvalOpportunity(evaluationOpportunitySize: string | undefined) {
  switch (evaluationOpportunitySize) {
    case 'Unlimited Users':
      return 10001;
    case 'Unknown':
    case 'Evaluation':
    case 'NA':
    case '':
    case null:
    case undefined:
      return -1;
    default:
      return +evaluationOpportunitySize;
  }
}

export function parseLicenseTier(tier: string) {
  switch (tier) {
    case 'Unlimited Users':
      return 10001;
    case 'Subscription': // it'll be in evaluationOpportunitySize instead
    case 'Evaluation':
    case 'Demonstration License':
      return -1;
  }

  const m = tier.match(/^(\d+) Users$/);
  assert.ok(m, `Unknown license tier: ${tier}`);

  return + m[1];
}

export function parseTransactionTier(tier: string) {
  if (tier === 'Unlimited Users') return 10001;

  let m;
  if (m = tier.match(/^Per Unit Pricing \((\d+) users\)$/)) {
    return +m[1];
  }
  if (m = tier.match(/^(\d+) Users$/)) {
    return +m[1];
  }

  assert.fail(`Unknown transaction tier: ${tier}`);
}
