import DataDir from "../../cache/datadir";
import log from "../../log/logger";
import { Association, EntityKind, ExistingEntity, FullEntity, NewEntity, RelativeAssociation } from "../../model/hubspot/interfaces";
import { HubspotService, Progress } from "../interfaces";

export class MemoryHubspot implements HubspotService {

  private ids = new Map<string, number>();

  private readonly deals = DataDir.in.file<FullEntity[]>(`deal.json`);
  private readonly companies = DataDir.in.file<FullEntity[]>(`company.json`);
  private readonly contacts = DataDir.in.file<FullEntity[]>(`contact.json`);

  // Downloader

  public async downloadEntities(_progress: Progress, kind: EntityKind, apiProperties: string[], inputAssociations: string[]): Promise<readonly FullEntity[]> {
    return this.arrayFor(kind);
  }

  // Uploader

  public async createEntities(kind: EntityKind, inputs: NewEntity[]): Promise<ExistingEntity[]> {
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

  public async updateEntities(kind: EntityKind, inputs: ExistingEntity[]): Promise<ExistingEntity[]> {
    for (const input of inputs) {
      const entity = this.getEntity(kind, input.id);
      Object.assign(entity.properties, input.properties);
    }

    this.fakeApiConsoleLog(`Fake-updated ${kind}s:`, inputs);
    return inputs;
  }

  public async createAssociations(fromKind: EntityKind, toKind: EntityKind, inputs: Association[]): Promise<void> {
    for (const input of inputs) {
      const entity = this.getEntity(fromKind, input.fromId);
      const assoc: RelativeAssociation = `${toKind}:${input.toId}`;
      if (!entity.associations.includes(assoc)) {
        entity.associations.push(assoc);
      }
    }

    this.fakeApiConsoleLog(`Fake Associating ${fromKind}s to ${toKind}s:`, inputs);
  }

  public async deleteAssociations(fromKind: EntityKind, toKind: EntityKind, inputs: Association[]): Promise<void> {
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

  private fakeApiConsoleLog(action: string, data: unknown[]) {
    log.info('Fake Uploader', action, data.length);
    if (data.length > 0) {
      log.verbose('Fake Uploader', action, data);
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
