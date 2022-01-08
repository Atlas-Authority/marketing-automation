import { IO } from "../io/io";
import { makeEmailValidationRegex } from "../io/live/domains";
import { MultiDownloadLogger } from "../log/download-logger";
import log from "../log/logger";
import { Table } from "../log/table";
import { Tallier } from "../log/tallier";
import env, { Config } from "../parameters/env-config";
import { formatMoney, formatNumber } from "../util/formatters";
import { isPresent } from "../util/helpers";
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

  public licensesByAddonLicenseId = new Map<string, License>();

  /** Domains that provide spam or free email accounts for masses. */
  public providerDomains = new Set<string>();
  public partnerDomains = new Set<string>();
  public customerDomains = new Set<string>();

  private emailProviderLister: EmailProviderLister;

  public tallier = new Tallier();

  public appToPlatform: { [addonKey: string]: string } = Object.create(null);
  public archivedApps = new Set<string>();

  public constructor(private io: IO, config: Config, populateFromEnv = true) {
    this.dealManager = new DealManager(io.in.hubspot, io.out.hubspot);
    this.contactManager = new ContactManager(io.in.hubspot, io.out.hubspot);
    this.companyManager = new CompanyManager(io.in.hubspot, io.out.hubspot);
    this.emailProviderLister = new EmailProviderLister(io.in.emailProviderLister);

    for (const domain of config.partnerDomains) {
      this.partnerDomains.add(domain);
    }

    if (populateFromEnv) {
      this.populateFromEnv();
    }
  }

  populateFromEnv() {
    this.appToPlatform = env.mpac.platforms;
    this.archivedApps = env.engine.archivedApps;
  }

  public async downloadAllData() {
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

    this.dealManager.linkAssociations(this);
    this.companyManager.linkAssociations(this);
    this.contactManager.linkAssociations(this);

    log.info('Downloader', 'Done');

    this.providerDomains = this.emailProviderLister.set;

    const emailRe = makeEmailValidationRegex(tlds);
    const results = validateMarketplaceData(
      licensesWithDataInsights,
      licensesWithoutDataInsights,
      transactions,
      emailRe);

    this.licenses = results.licenses.map(raw => License.fromRaw(raw));
    this.transactions = results.transactions.map(raw => Transaction.fromRaw(raw));

    for (const license of this.licenses) {
      if (license.data.addonLicenseId) {
        this.licensesByAddonLicenseId.set(license.data.addonLicenseId, license);
      }
    }

    for (const license of this.licenses) {
      if (license.data.newEvalData) {
        const evalLicense = this.licensesByAddonLicenseId.get(license.data.newEvalData.evaluationLicense);
        license.evaluatedFrom = evalLicense;
        evalLicense!.evaluatedTo = license;
      }
    }

    this.validateIdUniqueness();

    const transactionTotal = (this.transactions
      .map(t => t.data.vendorAmount)
      .reduce((a, b) => a + b));

    this.printDownloadSummary(transactionTotal);

    this.tallier.first('Transaction total', transactionTotal);
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

  private validateIdUniqueness() {
    log.info('Database', 'Validating MPAC ID uniqueness: Starting...')

    // All three should be unique on licenses
    verifyIdIsUnique(this.licenses, l => l.data.addonLicenseId);
    verifyIdIsUnique(this.licenses, l => l.data.appEntitlementId);
    verifyIdIsUnique(this.licenses, l => l.data.appEntitlementNumber);

    // All license IDs should point to the same transactions as each other
    for (const l of this.licenses) {
      const id1 = l.data.appEntitlementId;
      const id2 = l.data.appEntitlementNumber;
      const id3 = l.data.addonLicenseId;

      const array1 = id1 && this.transactions.filter(t => id1 === t.data.appEntitlementId);
      const array2 = id2 && this.transactions.filter(t => id2 === t.data.appEntitlementNumber);
      const array3 = id3 && this.transactions.filter(t => id3 === t.data.addonLicenseId);

      const set1 = array1 && uniqueSetFor(array1);
      const set2 = array2 && uniqueSetFor(array2);
      const set3 = array3 && uniqueSetFor(array3);

      verifySameSet(set1 || null, set2 || null);
      verifySameSet(set2 || null, set3 || null);
    }

    // All license IDs on each transaction should point to the same license
    // (I'm 99% certain this is the logical inverse of the above,
    //  but adding this quick assertion just in case I'm wrong.
    //  Like, what if an ID is missing on License but not Transaction?
    //  It's a bit confusing right now, and this test is cheap.)
    for (const t of this.transactions) {
      const id1 = t.data.appEntitlementId;
      const id2 = t.data.appEntitlementNumber;
      const id3 = t.data.addonLicenseId;

      const license1 = id1 && this.licenses.find(l => id1 === l.data.appEntitlementId);
      const license2 = id2 && this.licenses.find(l => id2 === l.data.appEntitlementNumber);
      const license3 = id3 && this.licenses.find(l => id3 === l.data.addonLicenseId);

      verifyEqual(license1 || null, license2 || null);
      verifyEqual(license2 || null, license3 || null);
    }

    log.info('Database', 'Validating MPAC ID uniqueness: Done')
  }

}

function verifyIdIsUnique(licenses: License[], getter: (r: License) => string | null) {
  const ids = licenses.map(getter).filter(isPresent);
  const idSet = new Set(ids);
  if (ids.length !== idSet.size) {
    const idName = getter.toString().replace(/(\w+) => \1\.data\./, '');
    log.error('Database', 'License IDs not unique:', idName);
  }
}

function uniqueSetFor(transactions: Transaction[]) {
  const set = new Set(transactions);
  if (set.size !== transactions.length) {
    log.error('Database', `Transactions aren't unique: got ${set.size} out of ${transactions.length}`);
  }
  return set;
}

function verifySameSet(set1: Set<Transaction> | null, set2: Set<Transaction> | null) {
  if (!set1 || !set2) return;

  const same = set1.size === set2.size && [...set1].every(t => set2.has(t));
  if (!same) {
    log.error('Database', `License IDs do not point to same transactions`);
  }
}

function verifyEqual(license1: License | null, license2: License | null) {
  if (!license1 || !license2) return;

  if (license1 !== license2) {
    log.error('Database', `License IDs do not point to same License from Transaction`);
  }
}
