import got from 'got';
import cache from '../cache.js';
import { TldListerService } from '../interfaces.js';

export function makeEmailValidationRegex(tlds: readonly string[]) {
  return new RegExp(`.+@.+\\.(${tlds.join('|')})`);
}

export class LiveTldListerService implements TldListerService {

  public async downloadAllTlds(): Promise<string[]> {
    const res = await got.get(`https://data.iana.org/TLD/tlds-alpha-by-domain.txt`);
    const tlds = res.body.trim().split('\n').splice(1).map(s => s.toLowerCase());
    return cache('tlds.json', tlds);
  }

}
