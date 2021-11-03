import fetch from 'node-fetch';
import cache from '../../io/cache.js';
import { TldListerService } from '../../io/interfaces.js';

export function makeEmailValidationRegex(tlds: readonly string[]) {
  return new RegExp(`.+@.+\\.(${tlds.join('|')})`);
}

export class LiveTldListerService implements TldListerService {

  async downloadAllTlds(): Promise<string[]> {
    const res = await fetch(`https://data.iana.org/TLD/tlds-alpha-by-domain.txt`);
    const text = await res.text();
    const tlds = text.trim().split('\n').splice(1).map(s => s.toLowerCase());
    return cache('tlds.json', tlds);
  }

}