import { IO } from "../io/io.js";
import { makeEmailValidationRegex } from "../io/live/domains.js";
import { MultiDownloadLogger } from "../log/download-logger.js";
import log from "../log/logger.js";
import { Table } from "../log/table.js";
import { Tallier } from "../log/tallier.js";
import { formatMoney, formatNumber } from "../util/formatters.js";
import { CompanyManager } from "./company.js";
import { ContactManager } from "./contact.js";
import { DealManager } from "./deal.js";
import { EmailProviderLister } from "./email-providers/index.js";
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

  emailProviderLister: EmailProviderLister;

  tallier = new Tallier();

  constructor(private io: IO) {
    this.dealManager = new DealManager(io.in.hubspot, io.out.hubspot, this);
    this.contactManager = new ContactManager(io.in.hubspot, io.out.hubspot, this);
    this.companyManager = new CompanyManager(io.in.hubspot, io.out.hubspot, this);
    this.emailProviderLister = new EmailProviderLister(io.in.emailProviderLister);
  }

  async downloadAllData() {
    log.info('Downloader', 'Starting downloads with API');

    const logbox = new MultiDownloadLogger();

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

    this.dealManager.linkAssociations();
    this.companyManager.linkAssociations();
    this.contactManager.linkAssociations();

    log.info('Downloader', 'Done');

    this.providerDomains = this.emailProviderLister.set;

    const emailRe = makeEmailValidationRegex(tlds);
    const results = validateMarketplaceData(
      licensesWithDataInsights,
      licensesWithoutDataInsights,
      transactions,
      emailRe);

    this.licenses = results.licenses.map(raw => new License(raw));
    this.transactions = results.transactions.map(raw => new Transaction(raw));

    const transactionTotal = (this.transactions
      .map(t => t.data.vendorAmount)
      .reduce((a, b) => a + b));

    this.printDownloadSummary(transactionTotal);

    this.tallier.first('Transaction total', transactionTotal);
  }

  printDownloadSummary(transactionTotal: number) {
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

  async syncUpAllEntities() {
    await this.dealManager.syncUpAllEntities();
    await this.contactManager.syncUpAllEntities();
    await this.companyManager.syncUpAllEntities();

    await this.dealManager.syncUpAllAssociations();
    await this.contactManager.syncUpAllAssociations();
    await this.companyManager.syncUpAllAssociations();
  }

  getEntity(kind: EntityKind, id: string): Entity<any, any> {
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
