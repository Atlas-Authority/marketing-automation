import { DataDir } from '../cache/datadir.js';
import config from '../config/index.js';
import { EntityKind, FullEntity } from '../model/hubspot/interfaces.js';
import { RawLicense, RawTransaction } from "../model/marketplace/raw";
import { downloadAllTlds, downloadFreeEmailProviders } from '../services/domains.js';
import Hubspot from '../services/hubspot.js';
import { downloadLicensesWithDataInsights, downloadLicensesWithoutDataInsights, downloadTransactions } from '../services/marketplace.js';
import { Downloader, Progress } from './interfaces.js';


export default class LiveDownloader implements Downloader {

  hubspot = new Hubspot();

  async downloadHubspotEntities(_progress: Progress, kind: EntityKind, apiProperties: string[], inputAssociations: string[]): Promise<FullEntity[]> {
    return cache(`${kind}.json`, await this.hubspot.downloadEntities(kind, apiProperties, inputAssociations));
  }

  async downloadFreeEmailProviders(): Promise<string[]> {
    return cache('domains.json', await downloadFreeEmailProviders());
  }

  async downloadAllTlds(): Promise<string[]> {
    return cache('tlds.json', await downloadAllTlds());
  }

  async downloadTransactions(): Promise<RawTransaction[]> {
    return cache('transactions.json', await downloadTransactions());
  }

  async downloadLicensesWithoutDataInsights(): Promise<RawLicense[]> {
    return cache('licenses-without.json', await downloadLicensesWithoutDataInsights());
  }

  async downloadLicensesWithDataInsights(progress: Progress): Promise<RawLicense[]> {
    return cache('licenses-with.json', await downloadLicensesWithDataInsights(progress));
  }

}

function cache<T>(file: string, data: T): T {
  if (!config.isProduction) {
    const content = JSON.stringify(data, null, 2);
    DataDir.in.writeFile(file, content);
  }
  return data;
}
