import { emailBurnerList } from 'burner-email-providers';
import allEmailProviders from 'email-providers';
import cache from '../io/cache.js';

/** A set of domains that host multiple unrelated email addresses */
export function makeMultiProviderDomainsSet(freeDomains: readonly string[]) {
  return new Set([
    ...emailBurnerList,
    ...allEmailProviders,
    ...freeDomains,
  ].map(d => d.toLowerCase()));
}

export async function downloadFreeEmailProviders(): Promise<string[]> {
  const res = await fetch(`https://f.hubspotusercontent40.net/hubfs/2832391/Marketing/Lead-Capture/free-domains-1.csv`);
  const text = await res.text();
  const domains = text.split(',\n');
  return cache('domains.json', domains);
}
