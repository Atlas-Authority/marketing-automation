import { Association, EntityKind, ExistingEntity, FullEntity, NewEntity } from "../model/hubspot/interfaces.js";
import { RawLicense, RawTransaction } from "../model/marketplace/raw";

export interface Progress {
  setCount: (count: number) => void;
  tick: (range: string) => void;
}

export interface HubspotService {
  downloadEntities(progress: Progress, kind: EntityKind, apiProperties: string[], inputAssociations: string[]): Promise<readonly FullEntity[]>;

  createEntities(kind: EntityKind, inputs: NewEntity[]): Promise<ExistingEntity[]>;
  updateEntities(kind: EntityKind, inputs: ExistingEntity[]): Promise<ExistingEntity[]>;

  createAssociations(fromKind: EntityKind, toKind: EntityKind, inputs: Association[]): Promise<void>;
  deleteAssociations(fromKind: EntityKind, toKind: EntityKind, inputs: Association[]): Promise<void>;
}

export interface TldListerService {
  downloadAllTlds(progress: Progress): Promise<readonly string[]>;
}

export interface EmailProviderListerService {
  downloadFreeEmailProviders(progress: Progress): Promise<readonly string[]>;
}

export interface MarketplaceService {
  downloadTransactions(progress: Progress): Promise<readonly RawTransaction[]>;
  downloadLicensesWithoutDataInsights(progress: Progress): Promise<readonly RawLicense[]>;
  downloadLicensesWithDataInsights(progress: Progress): Promise<readonly RawLicense[]>;
}

export interface Remote {
  hubspot: HubspotService;
  emailProviderLister: EmailProviderListerService;
  tldLister: TldListerService;
  marketplace: MarketplaceService;
}
