import { Association, EntityKind, ExistingEntity, FullEntity, NewEntity } from "../model/hubspot/interfaces.js";
import { RawLicense, RawTransaction } from "../model/marketplace/raw";

export interface Progress {
  setCount: (count: number) => void;
  tick: (range: string) => void;
}

export interface Downloader {
  downloadEntities(progress: Progress, kind: EntityKind, apiProperties: string[], inputAssociations: string[]): Promise<readonly FullEntity[]>;

  downloadFreeEmailProviders(progress: Progress): Promise<readonly string[]>;
  downloadAllTlds(progress: Progress): Promise<readonly string[]>;

  downloadTransactions(progress: Progress): Promise<readonly RawTransaction[]>;
  downloadLicensesWithoutDataInsights(progress: Progress): Promise<readonly RawLicense[]>;
  downloadLicensesWithDataInsights(progress: Progress): Promise<readonly RawLicense[]>;
}

export interface Uploader {
  createEntities(kind: EntityKind, inputs: NewEntity[]): Promise<ExistingEntity[]>;
  updateEntities(kind: EntityKind, inputs: ExistingEntity[]): Promise<ExistingEntity[]>;

  createAssociations(fromKind: EntityKind, toKind: EntityKind, inputs: Association[]): Promise<void>;
  deleteAssociations(fromKind: EntityKind, toKind: EntityKind, inputs: Association[]): Promise<void>;
}
