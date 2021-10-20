import { Association, EntityKind, ExistingEntity, NewEntity } from "../hubspot.js";

export interface Uploader {
  createHubspotEntities(kind: EntityKind, inputs: NewEntity[]): Promise<ExistingEntity[]>;
  updateHubspotEntities(kind: EntityKind, inputs: ExistingEntity[]): Promise<ExistingEntity[]>;

  createHubspotAssociations(fromKind: EntityKind, toKind: EntityKind, inputs: Association[]): Promise<void>;
  deleteHubspotAssociations(fromKind: EntityKind, toKind: EntityKind, inputs: Association[]): Promise<void>;
}
