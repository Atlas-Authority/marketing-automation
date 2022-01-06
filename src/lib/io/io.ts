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
  marketplace = new MemoryMarketplace(true);
  tldLister = new MemoryTldListerService(true);
  emailProviderLister = new MemoryEmailProviderListerService(true);
  hubspot = new MemoryHubspot(true);
}

export class MemoryRemote implements Remote {
  marketplace = new MemoryMarketplace(false);
  tldLister = new MemoryTldListerService(false);
  emailProviderLister = new MemoryEmailProviderListerService(false);
  hubspot = new MemoryHubspot(false);
}

export class LiveRemote implements Remote {
  hubspot: HubspotService;
  marketplace: MarketplaceService;
  emailProviderLister = new LiveEmailProviderListerService();
  tldLister = new LiveTldListerService();

  constructor(config: {
    hubspotCreds: HubspotCreds,
    mpacCreds: MpacCreds,
  }) {
    this.hubspot = new LiveHubspotService(config.hubspotCreds);
    this.marketplace = new LiveMarketplaceService(config.mpacCreds);
  }
}
