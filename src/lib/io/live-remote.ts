import { LiveTldListerService } from '../services/live/domains.js';
import { LiveEmailProviderListerService } from '../services/live/email-providers.js';
import LiveHubspotService from '../services/live/hubspot.js';
import { LiveMarketplaceService } from '../services/live/marketplace.js';
import { Remote } from './interfaces.js';


export default class LiveRemote implements Remote {

  hubspot = new LiveHubspotService();
  marketplace = new LiveMarketplaceService();
  emailProviderLister = new LiveEmailProviderListerService();
  tldLister = new LiveTldListerService();

}
