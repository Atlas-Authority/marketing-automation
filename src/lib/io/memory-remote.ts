import * as datadir from '../cache/datadir.js';
import log, { LogLevel, logLevel } from '../log/logger.js';
import { RawLicense, RawTransaction } from "../model/marketplace/raw.js";
import { Downloader, Progress } from "./downloader/downloader.js";
import { Association, EntityKind, ExistingEntity, FullEntity, NewEntity } from "./hubspot.js";
import { Uploader } from "./uploader/uploader.js";

export class MemoryRemote implements Downloader, Uploader {

  verbose: boolean;
  ids = new Map<string, number>();

  // Downloader

  constructor(opts?: { verbose?: boolean }) {
    this.verbose = opts?.verbose ?? logLevel >= LogLevel.Verbose;
  }

  async downloadHubspotEntities(_progress: Progress, kind: EntityKind, apiProperties: string[], inputAssociations: string[]): Promise<FullEntity[]> {
    return datadir.readJsonFile('in', `${kind}.json`);
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

  // Uploader

  async createHubspotEntities(kind: EntityKind, inputs: NewEntity[]): Promise<ExistingEntity[]> {
    const objects = inputs.map((o) => ({
      properties: o.properties,
      id: this.newUniqueId(kind),
    }));
    this.fakeApiConsoleLog(`Fake-created ${kind}s:`, objects);
    return objects;
  }

  private newUniqueId(kind: string): string {
    const id = (this.ids.get(kind) ?? 0) + 1;
    this.ids.set(kind, id);
    return `fake.${kind}.${id}`;
  }

  async updateHubspotEntities(kind: EntityKind, inputs: ExistingEntity[]): Promise<ExistingEntity[]> {
    this.fakeApiConsoleLog(`Fake-updated ${kind}s:`, inputs);
    return inputs;
  }

  async createHubspotAssociations(fromKind: EntityKind, toKind: EntityKind, inputs: Association[]): Promise<void> {
    this.fakeApiConsoleLog(`Fake Associating ${fromKind}s to ${toKind}s:`, inputs);
  }

  async deleteHubspotAssociations(fromKind: EntityKind, toKind: EntityKind, inputs: Association[]): Promise<void> {
    this.fakeApiConsoleLog(`Fake Unassociating ${fromKind}s to ${toKind}s:`, inputs);
  }

  fakeApiConsoleLog(title: string, data: unknown[]) {
    log.info('Fake Uploader', title, this.verbose ? data : data.length);
  }

}
