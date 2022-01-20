import DataDir from "../data/datadir";
import { HubspotCreds, MpacCreds } from "../parameters/interfaces";
import { HubspotService, MarketplaceService, Remote } from "./interfaces";
import { LiveTldListerService } from "./live/domains";
import { LiveEmailProviderListerService } from "./live/email-providers";
import LiveHubspotService from "./live/hubspot";
import { LiveMarketplaceService } from "./live/marketplace";
import { MemoryTldListerService } from "./memory/domains";
import { MemoryEmailProviderListerService } from "./memory/email-providers";
import { MemoryHubspot } from "./memory/hubspot";
import { MemoryMarketplace } from "./memory/marketplace";

export class IO {

  public in: Remote = new MemoryRemote();
  public out: Remote = this.in;

  /** You can pass one as a convenience; otherwise set them after construction. */
  public constructor(both?: Remote) {
    if (both) {
      this.in = this.out = both;
    }
  }

}

export class CachedMemoryRemote implements Remote {
  dataDir = new DataDir("in");
  marketplace = new MemoryMarketplace(this.dataDir);
  tldLister = new MemoryTldListerService(this.dataDir);
  emailProviderLister = new MemoryEmailProviderListerService(this.dataDir);
  hubspot = new MemoryHubspot(this.dataDir);
}

export class MemoryRemote implements Remote {
  marketplace = new MemoryMarketplace(null);
  tldLister = new MemoryTldListerService(null);
  emailProviderLister = new MemoryEmailProviderListerService(null);
  hubspot = new MemoryHubspot(null);
}

export class LiveRemote implements Remote {

  dataDir = new DataDir("in");

  hubspot: HubspotService;
  marketplace: MarketplaceService;
  emailProviderLister = new LiveEmailProviderListerService(this.dataDir);
  tldLister = new LiveTldListerService(this.dataDir);

  constructor(config: {
    hubspotCreds: HubspotCreds,
    mpacCreds: MpacCreds,
  }) {
    this.hubspot = new LiveHubspotService(this.dataDir, config.hubspotCreds);
    this.marketplace = new LiveMarketplaceService(this.dataDir, config.mpacCreds);
  }
}
