import { RawLicense, RawTransaction } from "../../model/marketplace/raw";
import { Company } from "../../types/company.js";
import { Contact } from "../../types/contact.js";
import { Deal } from "../../types/deal.js";
import { EntityKind, FullEntity } from "../hubspot.js";

export interface DownloadLogger {
  prepare(count: number): void;
  tick(moreInfo?: string): void;
}

export interface Downloader {
  downloadHubspotEntities(kind: EntityKind, apiProperties: string[], inputAssociations: string[]): Promise<FullEntity[]>;

  downloadFreeEmailProviders(downloadLogger: DownloadLogger): Promise<string[]>;
  downloadAllTlds(downloadLogger: DownloadLogger): Promise<string[]>;

  downloadTransactions(downloadLogger: DownloadLogger): Promise<RawTransaction[]>;
  downloadLicensesWithoutDataInsights(downloadLogger: DownloadLogger): Promise<RawLicense[]>;
  downloadLicensesWithDataInsights(downloadLogger: DownloadLogger): Promise<RawLicense[]>;
}
