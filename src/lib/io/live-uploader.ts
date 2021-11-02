import { Association, EntityKind, ExistingEntity, NewEntity } from '../model/hubspot/interfaces.js';
import Hubspot from '../services/hubspot.js';
import { Uploader } from './interfaces.js';


export default class LiveUploader implements Uploader {

  hubspot = new Hubspot();

  async createEntities(kind: EntityKind, inputs: NewEntity[]): Promise<ExistingEntity[]> {
    return await this.hubspot.createEntities(kind, inputs);
  }

  async updateEntities(kind: EntityKind, inputs: ExistingEntity[]): Promise<ExistingEntity[]> {
    return await this.hubspot.updateEntities(kind, inputs);
  }

  async createAssociations(fromKind: EntityKind, toKind: EntityKind, inputs: Association[]): Promise<void> {
    await this.hubspot.createAssociations(fromKind, toKind, inputs);
  }

  async deleteAssociations(fromKind: EntityKind, toKind: EntityKind, inputs: Association[]): Promise<void> {
    await this.hubspot.deleteAssociations(fromKind, toKind, inputs);
  }

}
