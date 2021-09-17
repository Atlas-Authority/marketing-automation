import { Company } from "../types/company.js";

export interface Downloader {
  downloadFreeEmailProviders(): Promise<string[]>;
  downloadAllTlds(): Promise<string[]>;

  downloadTransactions(): Promise<Transaction[]>;

  downloadLicensesWithoutDataInsights(): Promise<License[]>;
  downloadLicensesWithDataInsights(): Promise<License[]>;

  downloadAllDeals(): Promise<Deal[]>;
  downloadAllContacts(): Promise<Contact[]>;
  downloadAllCompanies(): Promise<Company[]>;
}
