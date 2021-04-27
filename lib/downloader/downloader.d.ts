interface Downloader {
  downloadFreeEmailProviders(): Promise<string[]>;

  downloadTransactions(): Promise<Transaction[]>;

  downloadLicensesWithoutDataInsights(): Promise<License[]>;
  downloadLicensesWithDataInsights(): Promise<License[]>;

  downloadAllDeals(): Promise<Deal[]>;
  downloadAllContacts(): Promise<Contact[]>;
  downloadAllCompanies(): Promise<Company[]>;
}
