import { Company } from "../types/company.js";
import { Contact } from "../types/contact.js";
import { Deal } from "../types/deal.js";
import { License } from "../types/license.js";
import { Transaction } from "../types/transaction.js";

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
