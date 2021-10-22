import log from '../../log/logger.js';
import { Association, EntityKind, ExistingEntity, NewEntity } from '../hubspot.js';
import { Uploader } from './uploader.js';

export default class ConsoleUploader implements Uploader {

  verbose: boolean;
  ids = new Map<string, number>();

  constructor({ verbose }: { verbose: boolean }) {
    this.verbose = verbose;
  }

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
