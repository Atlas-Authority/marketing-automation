import { RawLicense, RawTransaction } from "../model/marketplace/raw";
import { Association, EntityKind, ExistingEntity, FullEntity, NewEntity } from "./hubspot.js";

export interface Progress {
  setCount: (count: number) => void;
  tick: (range: string) => void;
}

export interface Downloader {
  downloadHubspotEntities(progress: Progress, kind: EntityKind, apiProperties: string[], inputAssociations: string[]): Promise<FullEntity[]>;

  downloadFreeEmailProviders(progress: Progress): Promise<string[]>;
  downloadAllTlds(progress: Progress): Promise<string[]>;

  downloadTransactions(progress: Progress): Promise<RawTransaction[]>;
  downloadLicensesWithoutDataInsights(progress: Progress): Promise<RawLicense[]>;
  downloadLicensesWithDataInsights(progress: Progress): Promise<RawLicense[]>;
}

export interface Uploader {
  createHubspotEntities(kind: EntityKind, inputs: NewEntity[]): Promise<ExistingEntity[]>;
  updateHubspotEntities(kind: EntityKind, inputs: ExistingEntity[]): Promise<ExistingEntity[]>;

  createHubspotAssociations(fromKind: EntityKind, toKind: EntityKind, inputs: Association[]): Promise<void>;
  deleteHubspotAssociations(fromKind: EntityKind, toKind: EntityKind, inputs: Association[]): Promise<void>;
}
