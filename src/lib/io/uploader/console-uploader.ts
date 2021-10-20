import log from '../../log/logger.js';
import { Association, EntityKind, ExistingEntity, NewEntity } from '../hubspot.js';
import { Uploader } from './uploader.js';

export default class ConsoleUploader implements Uploader {

  verbose: boolean;

  constructor({ verbose }: { verbose: boolean }) {
    this.verbose = verbose;
  }

  async createHubspotEntities(kind: EntityKind, inputs: NewEntity[]): Promise<ExistingEntity[]> {
    const objects = inputs.map((o, i) => ({
      properties: o.properties,
      id: (1000000000000 + i).toString(),
    }));
    this.fakeApiConsoleLog(`Fake-created ${kind}s:`, objects);
    return objects;
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
