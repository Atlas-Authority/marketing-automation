import { Remote } from "../io/interfaces.js";
import { LiveTldListerService } from '../services/live/domains.js';
import { LiveEmailProviderListerService } from '../services/live/email-providers.js';
import LiveHubspotService from '../services/live/hubspot.js';
import { LiveMarketplaceService } from '../services/live/marketplace.js';
import { MemoryTldListerService } from '../services/memory/domains.js';
import { MemoryEmailProviderListerService } from '../services/memory/email-providers.js';
import { MemoryHubspot } from '../services/memory/hubspot.js';
import { MemoryMarketplace } from '../services/memory/marketplace.js';

export class IO {

  public in: Remote;
  public out: Remote;

  constructor(opts: { in: 'local' | 'remote', out: 'local' | 'remote' }) {
    if (opts.in === 'local' && opts.out === 'local') {
      this.in = this.out = new MemoryRemote();
    }
    else if (opts.in === 'remote' && opts.out === 'remote') {
      this.in = this.out = new LiveRemote();
    }
    else {
      this.in = remoteFor(opts.in);
      this.out = remoteFor(opts.out);
    }
  }

}

function remoteFor(opt: 'local' | 'remote'): Remote {
  switch (opt) {
    case 'local': return new MemoryRemote();
    case 'remote': return new LiveRemote();
  }
}

class MemoryRemote implements Remote {
  marketplace = new MemoryMarketplace();
  tldLister = new MemoryTldListerService();
  emailProviderLister = new MemoryEmailProviderListerService();
  hubspot = new MemoryHubspot();
}

class LiveRemote implements Remote {
  hubspot = new LiveHubspotService();
  marketplace = new LiveMarketplaceService();
  emailProviderLister = new LiveEmailProviderListerService();
  tldLister = new LiveTldListerService();
}
