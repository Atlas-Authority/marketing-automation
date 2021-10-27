import * as datadir from '../cache/datadir.js';
import log, { LogLevel, logLevel } from '../log/logger.js';
import { RawLicense, RawTransaction } from "../model/marketplace/raw.js";
import { Association, EntityKind, ExistingEntity, FullEntity, NewEntity, RelativeAssociation } from "./hubspot.js";
import { Downloader, Progress, Uploader } from "./interfaces.js";

export class MemoryRemote implements Downloader, Uploader {

  verbose: boolean;
  ids = new Map<string, number>();

  contacts: FullEntity[];
  companies: FullEntity[];
  deals: FullEntity[];
  licensesWith: RawLicense[];
  licensesWithout: RawLicense[];
  transactions: RawTransaction[];
  domains: string[];
  tlds: string[];

  // Downloader

  constructor(opts?: { verbose?: boolean }) {
    this.verbose = opts?.verbose ?? logLevel >= LogLevel.Verbose;

    this.deals = datadir.readJsonFile('in', `deal.json`);
    this.companies = datadir.readJsonFile('in', `company.json`);
    this.contacts = datadir.readJsonFile('in', `contact.json`);

    this.licensesWith = datadir.readJsonFile('in', 'licenses-with.json');
    this.licensesWithout = datadir.readJsonFile('in', 'licenses-without.json');
    this.transactions = datadir.readJsonFile('in', 'transactions.json');

    this.tlds = datadir.readJsonFile('in', 'tlds.json');
    this.domains = datadir.readJsonFile('in', 'domains.json');
  }

  async downloadHubspotEntities(_progress: Progress, kind: EntityKind, apiProperties: string[], inputAssociations: string[]): Promise<FullEntity[]> {
    return this.arrayFor(kind);
  }

  async downloadFreeEmailProviders(): Promise<string[]> {
    return this.domains;
  }

  async downloadAllTlds(): Promise<string[]> {
    return this.tlds;
  }

  async downloadTransactions(): Promise<RawTransaction[]> {
    return this.transactions;
  }

  async downloadLicensesWithoutDataInsights(): Promise<RawLicense[]> {
    return this.licensesWithout;
  }

  async downloadLicensesWithDataInsights(): Promise<RawLicense[]> {
    return this.licensesWith;
  }

  // Uploader

  async createHubspotEntities(kind: EntityKind, inputs: NewEntity[]): Promise<ExistingEntity[]> {
    const objects = inputs.map((o) => ({
      properties: o.properties,
      id: this.newUniqueId(kind),
      associations: [],
    }));

    const array = this.arrayFor(kind);
    array.push(...objects);

    this.fakeApiConsoleLog(`Fake-created ${kind}s:`, objects);
    return objects;
  }

  private newUniqueId(kind: string): string {
    const id = (this.ids.get(kind) ?? 0) + 1;
    this.ids.set(kind, id);
    return `fake.${kind}.${id}`;
  }

  async updateHubspotEntities(kind: EntityKind, inputs: ExistingEntity[]): Promise<ExistingEntity[]> {
    for (const input of inputs) {
      const entity = this.getEntity(kind, input.id);
      Object.assign(entity, input.properties);
    }

    this.fakeApiConsoleLog(`Fake-updated ${kind}s:`, inputs);
    return inputs;
  }

  async createHubspotAssociations(fromKind: EntityKind, toKind: EntityKind, inputs: Association[]): Promise<void> {
    for (const input of inputs) {
      const entity = this.getEntity(fromKind, input.fromId);
      const assoc: RelativeAssociation = `${toKind}:${input.toId}`;
      if (!entity.associations.includes(assoc)) {
        entity.associations.push(assoc);
      }
    }

    this.fakeApiConsoleLog(`Fake Associating ${fromKind}s to ${toKind}s:`, inputs);
  }

  async deleteHubspotAssociations(fromKind: EntityKind, toKind: EntityKind, inputs: Association[]): Promise<void> {
    for (const input of inputs) {
      const entity = this.getEntity(fromKind, input.fromId);
      const assoc: RelativeAssociation = `${toKind}:${input.toId}`;
      const idx = entity.associations.indexOf(assoc);
      if (idx !== -1) {
        entity.associations.splice(idx, 1);
      }
    }

    this.fakeApiConsoleLog(`Fake Unassociating ${fromKind}s to ${toKind}s:`, inputs);
  }

  private fakeApiConsoleLog(title: string, data: unknown[]) {
    log.info('Fake Uploader', title, this.verbose ? data : data.length);
  }

  private getEntity(kind: EntityKind, id: string) {
    const entity = this.arrayFor(kind).find(e => e.id === id);
    if (!entity) throw new Error(`Entity kind=${kind} id=${id} doesn't exist in test environment`);
    return entity;
  }

  // Both

  private arrayFor(kind: EntityKind) {
    switch (kind) {
      case 'company': return this.companies;
      case 'contact': return this.contacts;
      case 'deal': return this.deals;
    }
  }

}
