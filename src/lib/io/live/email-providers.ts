import got from 'got';
import DataDir from '../../data/dir';

export class EmailProviderAPI {

  constructor(private dataDir: DataDir) { }

  public async downloadFreeEmailProviders(): Promise<string[]> {
    const res = await got.get(`https://f.hubspotusercontent40.net/hubfs/2832391/Marketing/Lead-Capture/free-domains-1.csv`);
    const domains = res.body.split(',\n');
    this.dataDir.file('domains.csv').writeArray(domains.map(domain => ({ domain })));
    return domains;
  }

}
