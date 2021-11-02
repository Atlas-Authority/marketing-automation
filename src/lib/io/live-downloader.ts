import { LiveTldListerService } from '../services/domains.js';
import { LiveEmailProviderListerService } from '../services/email-providers.js';
import LiveHubspotService from '../services/hubspot.js';
import { LiveMarketplaceService } from '../services/marketplace.js';
import { Downloader } from './interfaces.js';


export default class LiveDownloader implements Downloader {

  hubspot = new LiveHubspotService();
  marketplace = new LiveMarketplaceService();
  emailProviderLister = new LiveEmailProviderListerService();
  tldLister = new LiveTldListerService();

}
