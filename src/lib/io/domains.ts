import got from 'got';

export function makeEmailValidationRegex(tlds: readonly string[]) {
  return new RegExp(`.+@.+\\.(${tlds.join('|')})`);
}

export class TldListAPI {

  public async downloadAllTlds(): Promise<string[]> {
    const res = await got.get(`https://data.iana.org/TLD/tlds-alpha-by-domain.txt`);
    const tlds = res.body.trim().split('\n').splice(1).map(s => s.toLowerCase());
    return tlds;
  }

}
