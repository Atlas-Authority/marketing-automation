import { IO } from "../io/io";
import { makeEmailValidationRegex } from "../io/live/domains";
import { MultiDownloadLogger } from "../log/download-logger";
import log from "../log/logger";
import { Table } from "../log/table";
import { Tallier } from "../log/tallier";
import { formatMoney, formatNumber } from "../util/formatters";
import { CompanyManager } from "./company";
import { ContactManager } from "./contact";
import { DealManager } from "./deal";
import { EmailProviderLister } from "./email-providers";
import { Entity } from "./hubspot/entity";
import { EntityKind } from "./hubspot/interfaces";
import { License } from "./license";
import { validateMarketplaceData } from "./marketplace/validation";
import { Transaction } from "./transaction";

export class Database {

  public dealManager: DealManager;
  public contactManager: ContactManager;
  public companyManager: CompanyManager;

  public licenses: License[] = [];
  public transactions: Transaction[] = [];

  /** Domains that provide spam or free email accounts for masses. */
  public providerDomains = new Set<string>();
  public partnerDomains = new Set<string>();
  public customerDomains = new Set<string>();

  private emailProviderLister: EmailProviderLister;

  public tallier = new Tallier();

  public constructor(private io: IO) {
    this.dealManager = new DealManager(io.in.hubspot, io.out.hubspot);
    this.contactManager = new ContactManager(io.in.hubspot, io.out.hubspot);
    this.companyManager = new CompanyManager(io.in.hubspot, io.out.hubspot);
    this.emailProviderLister = new EmailProviderLister(io.in.emailProviderLister);
  }

  public async downloadAllData() {
    log.info('Downloader', 'Starting downloads with API');

    const logbox = new MultiDownloadLogger();

    await Promise.all([
      this.downloadMarketPlaceData(logbox),

      logbox.wrap('Free Email Providers', (progress) =>
        this.emailProviderLister.deriveMultiProviderDomainsSet(progress)),

      logbox.wrap('Deals', (progress) =>
        this.dealManager.downloadAllEntities(progress)),

      logbox.wrap('Companies', (progress) =>
        this.companyManager.downloadAllEntities(progress)),

      logbox.wrap('Contacts', (progress) =>
        this.contactManager.downloadAllEntities(progress)),
    ]);

    logbox.done();

    this.dealManager.linkAssociations(this);
    this.companyManager.linkAssociations(this);
    this.contactManager.linkAssociations(this);

    log.info('Downloader', 'Done');

    this.providerDomains = this.emailProviderLister.set;

    const transactionTotal = (this.transactions
      .map(t => t.data.vendorAmount)
      .reduce((a, b) => a + b, 0));

    this.printDownloadSummary(transactionTotal);

    this.tallier.first('Transaction total', transactionTotal);
  }

  private async downloadMarketPlaceData(logbox: MultiDownloadLogger) {
    return this.io.precomputed
      ? this.downloadPrecomputedMarketplaceData(logbox)
      : this.downloadRawMarketPlaceData(logbox);
  }

  private async downloadRawMarketPlaceData(logbox: MultiDownloadLogger) {
    const [
      tlds,
      licensesWithDataInsights,
      licensesWithoutDataInsights,
      transactions,
    ] = await Promise.all([
      logbox.wrap('Tlds', (progress) =>
        this.io.in.tldLister.downloadAllTlds(progress)),

      logbox.wrap('Licenses With Data Insights', (progress) =>
        this.io.in.marketplace.downloadLicensesWithDataInsights(progress)),

      logbox.wrap('Licenses Without Data Insights', (progress) =>
        this.io.in.marketplace.downloadLicensesWithoutDataInsights(progress)),

      logbox.wrap('Transactions', (progress) =>
        this.io.in.marketplace.downloadTransactions(progress)),
    ]);

    const emailRe = makeEmailValidationRegex(tlds);
    const results = validateMarketplaceData(
      licensesWithDataInsights,
      licensesWithoutDataInsights,
      transactions,
      emailRe);

    this.licenses = results.licenses.map(raw => License.fromRaw(raw));
    this.transactions = results.transactions.map(raw => Transaction.fromRaw(raw));
  }

  private async downloadPrecomputedMarketplaceData(logbox: MultiDownloadLogger) {
    const [
      ,
      licenses,
      transactions,
    ] = await Promise.all([
      logbox.wrap('Tlds', (progress) =>
        this.io.in.tldLister.downloadAllTlds(progress)),

      logbox.wrap('Precomputed Licenses', (progress) =>
        this.io.in.marketplace.downloadPrecomputedLicenses(progress)),

      logbox.wrap('Precomputed Transactions', (progress) =>
        this.io.in.marketplace.downloadPrecomputedTransactions(progress)),
    ]);

    this.licenses = licenses.map(license => new License(license.data));
    this.transactions = transactions.map(transaction => new Transaction(transaction.data));
  }

  private printDownloadSummary(transactionTotal: number) {
    const deals = this.dealManager.getArray();
    const dealSum = (deals
      .map(d => d.data.amount ?? 0)
      .reduce((a, b) => a + b, 0));

    const contacts = this.contactManager.getArray();

    const table = new Table([{}, { align: 'right' }]);
    table.rows.push(['# Licenses', formatNumber(this.licenses.length)]);
    table.rows.push(['# Transactions', formatNumber(this.transactions.length)]);
    table.rows.push(['$ Transactions', formatMoney(transactionTotal)]);
    table.rows.push(['# Contacts', formatNumber(contacts.length)]);
    table.rows.push(['# Deals', formatNumber(deals.length)]);
    table.rows.push(['$ Deals', formatMoney(dealSum)]);

    log.info('Downloader', 'Download Summary');
    for (const row of table.eachRow()) {
      log.info('Downloader', '  ' + row);
    }

  }

  public async syncUpAllEntities() {
    await this.dealManager.syncUpAllEntities();
    await this.contactManager.syncUpAllEntities();
    await this.companyManager.syncUpAllEntities();

    await this.dealManager.syncUpAllAssociations();
    await this.contactManager.syncUpAllAssociations();
    await this.companyManager.syncUpAllAssociations();
  }

  public getEntity(kind: EntityKind, id: string): Entity<any, any> {
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
