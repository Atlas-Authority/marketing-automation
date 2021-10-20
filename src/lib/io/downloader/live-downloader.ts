import * as datadir from '../../cache/datadir.js';
import config from '../../config/index.js';
import { RawLicense, RawTransaction } from "../../model/marketplace/raw";
import { downloadAllTlds, downloadFreeEmailProviders } from '../../services/domains.js';
import Hubspot from '../../services/hubspot.js';
import { downloadLicensesWithDataInsights, downloadLicensesWithoutDataInsights, downloadTransactions } from '../../services/marketplace.js';
import { EntityKind, FullEntity } from '../hubspot.js';
import { Downloader, DownloadLogger } from './downloader.js';


export default class LiveDownloader implements Downloader {

  hubspot = new Hubspot();

  async downloadHubspotEntities(kind: EntityKind, apiProperties: string[], inputAssociations: string[]): Promise<FullEntity[]> {
    const normalizedEntities = await this.hubspot.downloadEntities(kind, apiProperties, inputAssociations);
    save(`${kind}s2.json`, normalizedEntities);
    return normalizedEntities;
  }

  async downloadFreeEmailProviders(downloadLogger: DownloadLogger): Promise<string[]> {
    downloadLogger.prepare(1);
    const domains = await downloadFreeEmailProviders();
    downloadLogger.tick();
    save('domains.json', domains);
    return domains;
  }

  async downloadAllTlds(downloadLogger: DownloadLogger): Promise<string[]> {
    downloadLogger.prepare(1);
    const tlds = await downloadAllTlds();
    downloadLogger.tick();
    save('tlds.json', tlds);
    return tlds;
  }

  async downloadTransactions(downloadLogger: DownloadLogger): Promise<RawTransaction[]> {
    downloadLogger.prepare(1);
    const json: RawTransaction[] = await downloadTransactions();
    downloadLogger.tick();

    save('transactions.json', json);
    return json;
  }

  async downloadLicensesWithoutDataInsights(downloadLogger: DownloadLogger): Promise<RawLicense[]> {
    downloadLogger.prepare(1);
    let json: RawLicense[] = await downloadLicensesWithoutDataInsights();
    downloadLogger.tick();

    save('licenses-without.json', json);
    return json;
  }

  async downloadLicensesWithDataInsights(downloadLogger: DownloadLogger): Promise<RawLicense[]> {
    const licenses = await downloadLicensesWithDataInsights(
      downloadLogger.prepare,
      downloadLogger.tick
    );
    save('licenses-with.json', licenses);
    return licenses;
  }

}

function save(file: string, data: unknown) {
  if (config.isProduction) return;

  const content = JSON.stringify(data, null, 2);
  datadir.writeFile('in', file, content);
}
