import got from 'got';
import DataDir from '../../data/dir';
import { TldListerService } from '../interfaces';

export function makeEmailValidationRegex(tlds: readonly string[]) {
  return new RegExp(`.+@.+\\.(${tlds.join('|')})`);
}

export class LiveTldListerService implements TldListerService {

  constructor(private dataDir: DataDir) { }

  public async downloadAllTlds(): Promise<string[]> {
    const res = await got.get(`https://data.iana.org/TLD/tlds-alpha-by-domain.txt`);
    const tlds = res.body.trim().split('\n').splice(1).map(s => s.toLowerCase());
    this.dataDir.file('tlds.csv').writeArray(tlds.map(tld => ({ tld })));
    return tlds;
  }

}
