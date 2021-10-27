import { emailBurnerList } from 'burner-email-providers';
import allEmailProviders from 'email-providers';
import fetch from 'node-fetch';

export function makeEmailValidationRegex(tlds: readonly string[]) {
  return new RegExp(`.+@.+\\.(${tlds.join('|')})`);
}

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
  return domains;
}

export async function downloadAllTlds(): Promise<string[]> {
  const res = await fetch(`https://data.iana.org/TLD/tlds-alpha-by-domain.txt`);
  const text = await res.text();
  const tlds = text.trim().split('\n').splice(1).map(s => s.toLowerCase());
  return tlds;
}
