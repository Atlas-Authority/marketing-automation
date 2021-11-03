import cache from '../cache.js';
import { EmailProviderListerService } from '../interfaces.js';

export class LiveEmailProviderListerService implements EmailProviderListerService {

  async downloadFreeEmailProviders(): Promise<string[]> {
    const res = await fetch(`https://f.hubspotusercontent40.net/hubfs/2832391/Marketing/Lead-Capture/free-domains-1.csv`);
    const text = await res.text();
    const domains = text.split(',\n');
    return cache('domains.json', domains);
  }

}
