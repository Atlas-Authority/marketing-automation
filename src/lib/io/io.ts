import { Remote } from "./interfaces";
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

  public constructor(opts?: { in: 'local' | 'remote', out: 'local' | 'remote' }) {
    if (opts) {
      if (opts.in === opts.out) {
        // Important that it's the same instance!
        this.in = this.out = remoteFor(opts.in);
      }
      else {
        this.in = remoteFor(opts.in);
        this.out = remoteFor(opts.out);
      }
    }
  }

}

function remoteFor(opt: 'local' | 'remote'): Remote {
  switch (opt) {
    case 'local': return new CachedMemoryRemote();
    case 'remote': return new LiveRemote();
  }
}

class CachedMemoryRemote implements Remote {
  marketplace = new MemoryMarketplace(true);
  tldLister = new MemoryTldListerService(true);
  emailProviderLister = new MemoryEmailProviderListerService(true);
  hubspot = new MemoryHubspot(true);
}

class MemoryRemote implements Remote {
  marketplace = new MemoryMarketplace(false);
  tldLister = new MemoryTldListerService(false);
  emailProviderLister = new MemoryEmailProviderListerService(false);
  hubspot = new MemoryHubspot(false);
}

class LiveRemote implements Remote {
  hubspot = new LiveHubspotService();
  marketplace = new LiveMarketplaceService();
  emailProviderLister = new LiveEmailProviderListerService();
  tldLister = new LiveTldListerService();
}
