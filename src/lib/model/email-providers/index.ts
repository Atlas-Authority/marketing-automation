import { emailBurnerList } from 'burner-email-providers';
import allEmailProviders from 'email-providers';
import { EmailProviderListerService, Progress } from '../../io/interfaces.js';

export class EmailProviderLister {

  set = new Set<string>();

  constructor(private service: EmailProviderListerService) { }

  /** A set of domains that host multiple unrelated email addresses */
  async deriveMultiProviderDomainsSet(progress: Progress) {
    const freeDomains = await this.service.downloadFreeEmailProviders(progress);

    this.set = new Set([
      ...emailBurnerList,
      ...allEmailProviders,
      ...freeDomains,
    ].map(d => d.toLowerCase()));
  }

}
