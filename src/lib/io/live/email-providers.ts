import got from 'got';
import DataDir from '../../cache/datadir';
import { EmailProviderListerService } from '../interfaces';

export class LiveEmailProviderListerService implements EmailProviderListerService {

  constructor(private dataDir: DataDir) { }

  public async downloadFreeEmailProviders(): Promise<string[]> {
    const res = await got.get(`https://f.hubspotusercontent40.net/hubfs/2832391/Marketing/Lead-Capture/free-domains-1.csv`);
    const domains = res.body.split(',\n');
    this.dataDir.file('domains.json').writeJson(domains);
    return domains;
  }

}
