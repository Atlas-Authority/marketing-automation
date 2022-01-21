import DataDir from "../data/dir";
import { FullEntity } from "../model/hubspot/interfaces";
import { RawLicense, RawTransaction } from "../model/marketplace/raw";
import { HubspotCreds, MpacCreds } from "../parameters/interfaces";
import { Data } from "./interfaces";
import { LiveTldListerService } from "./live/domains";
import { LiveEmailProviderListerService } from "./live/email-providers";
import LiveHubspotService from "./live/hubspot";
import { LiveMarketplaceService } from "./live/marketplace";

export function loadDataFromDisk(dataDir: DataDir): Data {
  return {
    licensesWithDataInsights: dataDir.file<readonly RawLicense[]>('licenses-with.csv').readArray(),
    licensesWithoutDataInsights: dataDir.file<readonly RawLicense[]>('licenses-without.csv').readArray(),
    transactions: dataDir.file<readonly RawTransaction[]>('transactions.csv').readArray(),
    tlds: dataDir.file<readonly { tld: string }[]>('tlds.csv').readArray().map(({ tld }) => tld),
    freeDomains: dataDir.file<readonly { domain: string }[]>('domains.csv').readArray().map(({ domain }) => domain),
    rawDeals: dataDir.file<FullEntity[]>(`deal.csv`).readArray(),
    rawCompanies: dataDir.file<FullEntity[]>(`company.csv`).readArray(),
    rawContacts: dataDir.file<FullEntity[]>(`contact.csv`).readArray(),
  }
}

export class LiveRemote {

  hubspot;
  marketplace;
  emailProviderLister;
  tldLister;

  constructor(private dataDir: DataDir, config: {
    hubspotCreds: HubspotCreds,
    mpacCreds: MpacCreds,
  }) {
    this.hubspot = new LiveHubspotService(this.dataDir, config.hubspotCreds);
    this.marketplace = new LiveMarketplaceService(this.dataDir, config.mpacCreds);
    this.emailProviderLister = new LiveEmailProviderListerService(this.dataDir);
    this.tldLister = new LiveTldListerService(this.dataDir);
  }

}
