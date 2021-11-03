import { MemoryTldListerService } from '../services/memory/domains.js';
import { MemoryEmailProviderListerService } from '../services/memory/email-providers.js';
import { MemoryHubspot } from '../services/memory/hubspot.js';
import { MemoryMarketplace } from '../services/memory/marketplace.js';
import { Remote } from "./interfaces.js";

export class MemoryRemote implements Remote {

  marketplace = new MemoryMarketplace();
  tldLister = new MemoryTldListerService();
  emailProviderLister = new MemoryEmailProviderListerService();
  hubspot = new MemoryHubspot();

}
