import { LiveTldListerService } from '../services/live/domains.js';
import { LiveEmailProviderListerService } from '../services/live/email-providers.js';
import LiveHubspotService from '../services/live/hubspot.js';
import { LiveMarketplaceService } from '../services/live/marketplace.js';
import { Downloader } from './interfaces.js';


export default class LiveDownloader implements Downloader {

  hubspot = new LiveHubspotService();
  marketplace = new LiveMarketplaceService();
  emailProviderLister = new LiveEmailProviderListerService();
  tldLister = new LiveTldListerService();

}
