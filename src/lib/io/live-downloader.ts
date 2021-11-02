import { EntityKind, FullEntity } from '../model/hubspot/interfaces.js';
import { RawLicense, RawTransaction } from "../model/marketplace/raw";
import { downloadAllTlds } from '../services/domains.js';
import { downloadFreeEmailProviders } from '../services/email-providers.js';
import LiveHubspotService from '../services/hubspot.js';
import { LiveMarketplaceService } from '../services/marketplace.js';
import { Downloader, Progress } from './interfaces.js';


export default class LiveDownloader implements Downloader {

  hubspot = new LiveHubspotService();
  mpac = new LiveMarketplaceService();

  async downloadEntities(_progress: Progress, kind: EntityKind, apiProperties: string[], inputAssociations: string[]): Promise<FullEntity[]> {
    return await this.hubspot.downloadEntities(kind, apiProperties, inputAssociations);
  }

  async downloadFreeEmailProviders(): Promise<string[]> {
    return await downloadFreeEmailProviders();
  }

  async downloadAllTlds(): Promise<string[]> {
    return await downloadAllTlds();
  }

  async downloadTransactions(): Promise<RawTransaction[]> {
    return await this.mpac.downloadTransactions();
  }

  async downloadLicensesWithoutDataInsights(): Promise<RawLicense[]> {
    return await this.mpac.downloadLicensesWithoutDataInsights();
  }

  async downloadLicensesWithDataInsights(progress: Progress): Promise<RawLicense[]> {
    return await this.mpac.downloadLicensesWithDataInsights(progress);
  }

}
