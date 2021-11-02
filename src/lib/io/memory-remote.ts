import DataDir from '../cache/datadir.js';
import log, { LogLevel, logLevel } from '../log/logger.js';
import { Association, EntityKind, ExistingEntity, FullEntity, NewEntity, RelativeAssociation } from "../model/hubspot/interfaces.js";
import { RawLicense, RawTransaction } from "../model/marketplace/raw.js";
import { Downloader, Progress, Uploader } from "./interfaces.js";

export class MemoryRemote implements Downloader, Uploader {

  verbose: boolean;
  ids = new Map<string, number>();

  readonly deals = DataDir.in.file<FullEntity[]>(`deal.json`);
  readonly companies = DataDir.in.file<FullEntity[]>(`company.json`);
  readonly contacts = DataDir.in.file<FullEntity[]>(`contact.json`);

  readonly licensesWith = DataDir.in.file<readonly RawLicense[]>('licenses-with.json');
  readonly licensesWithout = DataDir.in.file<readonly RawLicense[]>('licenses-without.json');
  readonly transactions = DataDir.in.file<readonly RawTransaction[]>('transactions.json');

  readonly tlds = DataDir.in.file<readonly string[]>('tlds.json');
  readonly domains = DataDir.in.file<readonly string[]>('domains.json');

  // Downloader

  constructor(opts?: { verbose?: boolean }) {
    this.verbose = opts?.verbose ?? logLevel >= LogLevel.Verbose;
  }

  async downloadEntities(_progress: Progress, kind: EntityKind, apiProperties: string[], inputAssociations: string[]): Promise<readonly FullEntity[]> {
    return this.arrayFor(kind);
  }

  async downloadFreeEmailProviders(): Promise<readonly string[]> {
    return this.domains.readJson();
  }

  async downloadAllTlds(): Promise<readonly string[]> {
    return this.tlds.readJson();
  }

  async downloadTransactions(): Promise<readonly RawTransaction[]> {
    return this.transactions.readJson();
  }

  async downloadLicensesWithoutDataInsights(): Promise<readonly RawLicense[]> {
    return this.licensesWithout.readJson();
  }

  async downloadLicensesWithDataInsights(): Promise<readonly RawLicense[]> {
    return this.licensesWith.readJson();
  }

  // Uploader

  async createEntities(kind: EntityKind, inputs: NewEntity[]): Promise<ExistingEntity[]> {
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

  async updateEntities(kind: EntityKind, inputs: ExistingEntity[]): Promise<ExistingEntity[]> {
    for (const input of inputs) {
      const entity = this.getEntity(kind, input.id);
      Object.assign(entity.properties, input.properties);
    }

    this.fakeApiConsoleLog(`Fake-updated ${kind}s:`, inputs);
    return inputs;
  }

  async createAssociations(fromKind: EntityKind, toKind: EntityKind, inputs: Association[]): Promise<void> {
    for (const input of inputs) {
      const entity = this.getEntity(fromKind, input.fromId);
      const assoc: RelativeAssociation = `${toKind}:${input.toId}`;
      if (!entity.associations.includes(assoc)) {
        entity.associations.push(assoc);
      }
    }

    this.fakeApiConsoleLog(`Fake Associating ${fromKind}s to ${toKind}s:`, inputs);
  }

  async deleteAssociations(fromKind: EntityKind, toKind: EntityKind, inputs: Association[]): Promise<void> {
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
    log.info('Fake Uploader', title, data.length);
    if (this.verbose) {
      log.verbose('Fake Uploader', title, data);
    }
  }

  private getEntity(kind: EntityKind, id: string) {
    const entity = this.arrayFor(kind).find(e => e.id === id);
    if (!entity) throw new Error(`Entity kind=${kind} id=${id} doesn't exist in test environment`);
    return entity;
  }

  // Both

  private arrayFor(kind: EntityKind) {
    switch (kind) {
      case 'company': return this.companies.readJson();
      case 'contact': return this.contacts.readJson();
      case 'deal': return this.deals.readJson();
    }
  }

}
