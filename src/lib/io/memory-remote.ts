import { MemoryTldListerService } from '../services/memory/domains.js';
import { MemoryEmailProviderListerService } from '../services/memory/email-providers.js';
import { MemoryHubspot } from '../services/memory/hubspot.js';
import { MemoryMarketplace } from '../services/memory/marketplace.js';
import { Downloader, Uploader } from "./interfaces.js";

export class MemoryRemote implements Downloader, Uploader {

  marketplace = new MemoryMarketplace();
  tldLister = new MemoryTldListerService();
  emailProviderLister = new MemoryEmailProviderListerService();
  hubspot = new MemoryHubspot();

}
