import { Company } from "../types/company.js";
import { Contact } from "../types/contact.js";
import { Deal } from "../types/deal.js";
import { License } from "../types/license.js";
import { Transaction } from "../types/transaction.js";

export interface DownloadLogger {
  prepare(count: number): void;
  tick(moreInfo?: string): void;
}

export interface Downloader {
  downloadFreeEmailProviders(downloadLogger: DownloadLogger): Promise<string[]>;
  downloadAllTlds(downloadLogger: DownloadLogger): Promise<string[]>;

  downloadTransactions(downloadLogger: DownloadLogger): Promise<Transaction[]>;

  downloadLicensesWithoutDataInsights(downloadLogger: DownloadLogger): Promise<License[]>;
  downloadLicensesWithDataInsights(downloadLogger: DownloadLogger): Promise<License[]>;

  downloadAllDeals(downloadLogger: DownloadLogger): Promise<Deal[]>;
  downloadAllContacts(downloadLogger: DownloadLogger): Promise<Contact[]>;
  downloadAllCompanies(downloadLogger: DownloadLogger): Promise<Company[]>;
}
