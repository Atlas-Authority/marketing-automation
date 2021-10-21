import * as datadir from '../../cache/datadir.js';
import { RawLicense, RawTransaction } from "../../model/marketplace/raw";
import { EntityKind, FullEntity } from '../hubspot.js';
import { Downloader, Progress } from './downloader.js';

export default class CachedFileDownloader implements Downloader {

  async downloadHubspotEntities(_progress: Progress, kind: EntityKind, apiProperties: string[], inputAssociations: string[]): Promise<FullEntity[]> {
    return datadir.readJsonFile('in', `${kind}s2.json`);
  }

  async downloadFreeEmailProviders(): Promise<string[]> {
    return datadir.readJsonFile('in', 'domains.json');
  }

  async downloadAllTlds(): Promise<string[]> {
    return datadir.readJsonFile('in', 'tlds.json');
  }

  async downloadTransactions(): Promise<RawTransaction[]> {
    return datadir.readJsonFile('in', 'transactions.json');
  }

  async downloadLicensesWithoutDataInsights(): Promise<RawLicense[]> {
    return datadir.readJsonFile('in', 'licenses-without.json');
  }

  async downloadLicensesWithDataInsights(): Promise<RawLicense[]> {
    return datadir.readJsonFile('in', 'licenses-with.json');
  }

}
