import got from 'got';
import cache from '../cache.js';
import { EmailProviderListerService } from '../interfaces.js';

export class LiveEmailProviderListerService implements EmailProviderListerService {

  public async downloadFreeEmailProviders(): Promise<string[]> {
    const res = await got.get(`https://f.hubspotusercontent40.net/hubfs/2832391/Marketing/Lead-Capture/free-domains-1.csv`);
    const domains = res.body.split(',\n');
    return cache('domains.json', domains);
  }

}
