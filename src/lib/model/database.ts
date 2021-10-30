import { Downloader, Uploader } from "../io/interfaces.js";
import { MultiDownloadLogger } from "../log/download-logger.js";
import log from "../log/logger.js";
import { makeEmailValidationRegex, makeMultiProviderDomainsSet } from "../services/domains.js";
import { formatMoney, formatNumber } from "../util/formatters.js";
import { CompanyManager } from "./company.js";
import { ContactManager } from "./contact.js";
import { DealManager } from "./deal.js";
import { Entity } from "./hubspot/entity.js";
import { EntityKind } from "./hubspot/interfaces.js";
import { License } from "./license.js";
import { validateMarketplaceData } from "./marketplace/validation.js";
import { Transaction } from "./transaction.js";

export class Database {

  dealManager: DealManager;
  contactManager: ContactManager;
  companyManager: CompanyManager;

  licenses: License[] = [];
  transactions: Transaction[] = [];

  /** Domains that provide spam or free email accounts for masses. */
  providerDomains = new Set<string>();
  partnerDomains = new Set<string>();
  customerDomains = new Set<string>();

  constructor(private downloader: Downloader, uploader: Uploader) {
    this.dealManager = new DealManager(downloader, uploader, this);
    this.contactManager = new ContactManager(downloader, uploader, this);
    this.companyManager = new CompanyManager(downloader, uploader, this);
  }

  async downloadAllData() {
    log.info('Downloader', 'Starting downloads with API');

    const logbox = new MultiDownloadLogger();

    const [
      freeDomains,
      tlds,
      licensesWithDataInsights,
      licensesWithoutDataInsights,
      transactions,
    ] = await Promise.all([
      logbox.wrap('Free Email Providers', (progress) =>
        this.downloader.downloadFreeEmailProviders(progress)),

      logbox.wrap('Tlds', (progress) =>
        this.downloader.downloadAllTlds(progress)),

      logbox.wrap('Licenses With Data Insights', (progress) =>
        this.downloader.downloadLicensesWithDataInsights(progress)),

      logbox.wrap('Licenses Without Data Insights', (progress) =>
        this.downloader.downloadLicensesWithoutDataInsights(progress)),

      logbox.wrap('Transactions', (progress) =>
        this.downloader.downloadTransactions(progress)),

      logbox.wrap('Deals', (progress) =>
        this.dealManager.downloadAllEntities(progress)),

      logbox.wrap('Companies', (progress) =>
        this.companyManager.downloadAllEntities(progress)),

      logbox.wrap('Contacts', (progress) =>
        this.contactManager.downloadAllEntities(progress)),
    ]);

    logbox.done();

    log.info('Downloader', 'Done');

    this.providerDomains = makeMultiProviderDomainsSet(freeDomains);

    const emailRe = makeEmailValidationRegex(tlds);
    const results = validateMarketplaceData(
      licensesWithDataInsights,
      licensesWithoutDataInsights,
      transactions,
      emailRe);

    this.licenses = results.licenses.map(raw => new License(raw));
    this.transactions = results.transactions.map(raw => new Transaction(raw));

    log.info('Dev', 'Licenses', formatNumber(this.licenses.length));
    log.info('Dev', 'Transactions', formatNumber(this.transactions.length));
    log.info('Dev', 'Amount in Transactions', formatMoney(
      this.transactions
        .map(t => t.data.vendorAmount)
        .reduce((a, b) => a + b)));
  }

  async syncUpAllEntities() {
    await this.dealManager.syncUpAllEntities();
    await this.contactManager.syncUpAllEntities();
    await this.companyManager.syncUpAllEntities();
  }

  getEntity(kind: EntityKind, id: string): Entity<any> {
    const found = this.getManager(kind).get(id);
    // There's only two ways to set associations:
    // 1. They were already set in HubSpot when we downloaded them, or
    // 2. We set them in code with an object already having a valid id.
    // In either case, an invalid id would fail before this method.
    if (!found) throw new Error(`Expected to find ${kind} with id ${id}`);
    return found;
  }

  private getManager(kind: EntityKind) {
    switch (kind) {
      case 'deal': return this.dealManager;
      case 'company': return this.companyManager;
      case 'contact': return this.contactManager;
    }
  }

}
