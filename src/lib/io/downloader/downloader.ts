import { Company } from "../../types/company.js";
import { Contact } from "../../types/contact.js";
import { Deal } from "../../types/deal.js";
import { RawLicense, RawTransaction } from "../../types/marketplace.js";

export interface DownloadLogger {
  prepare(count: number): void;
  tick(moreInfo?: string): void;
}

export interface Downloader {
  downloadFreeEmailProviders(downloadLogger: DownloadLogger): Promise<string[]>;
  downloadAllTlds(downloadLogger: DownloadLogger): Promise<string[]>;

  downloadTransactions(downloadLogger: DownloadLogger): Promise<RawTransaction[]>;
  downloadLicensesWithoutDataInsights(downloadLogger: DownloadLogger): Promise<RawLicense[]>;
  downloadLicensesWithDataInsights(downloadLogger: DownloadLogger): Promise<RawLicense[]>;

  downloadAllDeals(downloadLogger: DownloadLogger): Promise<Deal[]>;
  downloadAllContacts(downloadLogger: DownloadLogger): Promise<Contact[]>;
  downloadAllCompanies(downloadLogger: DownloadLogger): Promise<Company[]>;
}
