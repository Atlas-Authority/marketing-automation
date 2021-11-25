import { emailBurnerList } from 'burner-email-providers';
import * as allEmailProviders from 'email-providers';
import { EmailProviderListerService, Progress } from '../../io/interfaces.js';

export class EmailProviderLister {

  public set = new Set<string>();

  public constructor(private service: EmailProviderListerService) { }

  /** A set of domains that host multiple unrelated email addresses */
  public async deriveMultiProviderDomainsSet(progress: Progress) {
    const freeDomains = await this.service.downloadFreeEmailProviders(progress);

    this.set = new Set([
      ...emailBurnerList,
      ...allEmailProviders,
      ...freeDomains,
    ].map(d => d.toLowerCase()));
  }

}
