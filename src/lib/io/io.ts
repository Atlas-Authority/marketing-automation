import DataDir from "../data/dir";
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

export class CachedMemoryRemote implements Remote {
  dataDir = DataDir.root.subdir("in");
  marketplace = new MemoryMarketplace(this.dataDir);
  tldLister = new MemoryTldListerService(this.dataDir);
  emailProviderLister = new MemoryEmailProviderListerService(this.dataDir);
  hubspot = new MemoryHubspot(this.dataDir);
}

export class LiveRemote implements Remote {

  dataDir = DataDir.root.subdir("in");

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
