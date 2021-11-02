import fetch from 'node-fetch';

export function makeEmailValidationRegex(tlds: readonly string[]) {
  return new RegExp(`.+@.+\\.(${tlds.join('|')})`);
}

export async function downloadAllTlds(): Promise<string[]> {
  const res = await fetch(`https://data.iana.org/TLD/tlds-alpha-by-domain.txt`);
  const text = await res.text();
  const tlds = text.trim().split('\n').splice(1).map(s => s.toLowerCase());
  return tlds;
}
