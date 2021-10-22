import * as datadir from '../../cache/datadir.js';
import config from '../../config/index.js';
import { RawLicense, RawTransaction } from "../../model/marketplace/raw";
import { downloadAllTlds, downloadFreeEmailProviders } from '../../services/domains.js';
import Hubspot from '../../services/hubspot.js';
import { downloadLicensesWithDataInsights, downloadLicensesWithoutDataInsights, downloadTransactions } from '../../services/marketplace.js';
import { EntityKind, FullEntity } from '../hubspot.js';
import { Downloader, Progress } from './downloader.js';


export default class LiveDownloader implements Downloader {

  hubspot = new Hubspot();

  async downloadHubspotEntities(_progress: Progress, kind: EntityKind, apiProperties: string[], inputAssociations: string[]): Promise<FullEntity[]> {
    const normalizedEntities = await this.hubspot.downloadEntities(kind, apiProperties, inputAssociations);
    save(`${kind}.json`, normalizedEntities);
    return normalizedEntities;
  }

  async downloadFreeEmailProviders(): Promise<string[]> {
    const domains = await downloadFreeEmailProviders();
    save('domains.json', domains);
    return domains;
  }

  async downloadAllTlds(): Promise<string[]> {
    const tlds = await downloadAllTlds();
    save('tlds.json', tlds);
    return tlds;
  }

  async downloadTransactions(): Promise<RawTransaction[]> {
    const json = await downloadTransactions();
    save('transactions.json', json);
    return json;
  }

  async downloadLicensesWithoutDataInsights(): Promise<RawLicense[]> {
    let json = await downloadLicensesWithoutDataInsights();
    save('licenses-without.json', json);
    return json;
  }

  async downloadLicensesWithDataInsights(progress: Progress): Promise<RawLicense[]> {
    const licenses = await downloadLicensesWithDataInsights(progress);
    save('licenses-with.json', licenses);
    return licenses;
  }

}

function save(file: string, data: unknown) {
  if (config.isProduction) return;

  const content = JSON.stringify(data, null, 2);
  datadir.writeFile('in', file, content);
}
