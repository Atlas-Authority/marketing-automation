import { Association, EntityKind, ExistingEntity, FullEntity, NewEntity } from "../model/hubspot/interfaces";
import { RawLicense, RawTransaction } from "../model/marketplace/raw";

export interface Progress {
  setCount: (count: number) => void;
  tick: (range: string) => void;
}

export interface HubspotUploader {
  createEntities(kind: EntityKind, inputs: NewEntity[]): Promise<ExistingEntity[]>;
  updateEntities(kind: EntityKind, inputs: ExistingEntity[]): Promise<ExistingEntity[]>;

  createAssociations(fromKind: EntityKind, toKind: EntityKind, inputs: Association[]): Promise<void>;
  deleteAssociations(fromKind: EntityKind, toKind: EntityKind, inputs: Association[]): Promise<void>;
}

export interface Data {
  tlds: readonly string[];
  licensesWithDataInsights: readonly RawLicense[];
  licensesWithoutDataInsights: readonly RawLicense[];
  transactions: readonly RawTransaction[];
  freeDomains: readonly string[];
  rawDeals: readonly FullEntity[];
  rawCompanies: readonly FullEntity[];
  rawContacts: readonly FullEntity[];
}
