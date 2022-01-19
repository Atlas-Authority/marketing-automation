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
import { Transaction, TransactionData } from "./transaction";

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

    const licenses = [
      ...licensesWithDataInsights,
      ...licensesWithoutDataInsights,
    ].map(raw => License.fromRaw(raw));

    const results = validateMarketplaceData(
      licenses,
      transactions.map(raw => Transaction.fromRaw(raw)),
      emailRe);

    this.licenses = results.licenses;
    this.transactions = results.transactions;

    log.info('Database', 'Connecting MPAC records: Starting...');
    this.buildMpacMappings();
    log.info('Database', 'Connecting MPAC records: Done');

    const transactionTotal = (this.transactions
      .map(t => t.data.vendorAmount)
      .reduce((a, b) => a + b));

    this.printDownloadSummary(transactionTotal);

    this.tallier.first('Transaction total', transactionTotal);
  }

  private buildMpacMappings() {
    // All three should be unique on licenses
    verifyIdIsUnique(this.licenses, l => l.data.addonLicenseId);
    verifyIdIsUnique(this.licenses, l => l.data.appEntitlementId);
    verifyIdIsUnique(this.licenses, l => l.data.appEntitlementNumber);

    const licensesByAddonLicenseId = new Map<string, License>();

    // Map all licenses first
    for (const license of this.licenses) {

      // All license IDs (when present) should point to the same transactions as each other
      const id1 = license.data.appEntitlementId;
      const id2 = license.data.appEntitlementNumber;
      const id3 = license.data.addonLicenseId;

      const array1 = !id1 ? null : this.transactions.filter(t => id1 === t.data.appEntitlementId);
      const array2 = !id2 ? null : this.transactions.filter(t => id2 === t.data.appEntitlementNumber);
      const array3 = !id3 ? null : this.transactions.filter(t => id3 === t.data.addonLicenseId);

      const set1 = array1 && uniqueTransactionSetFrom(array1);
      const set2 = array2 && uniqueTransactionSetFrom(array2);
      const set3 = array3 && uniqueTransactionSetFrom(array3);

      verifySameTransactionSet(set1 || null, set2 || null);
      verifySameTransactionSet(set2 || null, set3 || null);

      // Store transactions on license, and vice versa
      license.transactions = (array1 ?? array2 ?? array3)!;
      for (const t of license.transactions) {
        t.license = license;
      }

      // Map licenses by their 3 IDs
      if (license.data.addonLicenseId) {
        if (license.data.addonLicenseId) licensesByAddonLicenseId.set(license.data.addonLicenseId, license);
      }
    }

    // Connect via license's `evaluationLicense` if present
    for (const license of this.licenses) {
      if (license.data.newEvalData) {
        const evalLicense = licensesByAddonLicenseId.get(license.data.newEvalData.evaluationLicense);
        license.evaluatedFrom = evalLicense;
        evalLicense!.evaluatedTo = license;
      }
    }

    // Connect Licenses and Transactions
    const maybeRefunded = new Set<Transaction>();
    const refunds = new Set<Transaction>();

    for (const transaction of this.transactions) {

      // All license IDs on each transaction should point to the same license
      // (I'm 99% certain this is the logical inverse of the above,
      //  but adding this quick assertion just in case I'm wrong.
      //  Like, what if an ID is missing on License but not Transaction?
      //  It's a bit confusing right now, and this test is cheap.)
      const id1 = transaction.data.appEntitlementId;
      const id2 = transaction.data.appEntitlementNumber;
      const id3 = transaction.data.addonLicenseId;

      const license1 = id1 && this.licenses.find(l => id1 === l.data.appEntitlementId);
      const license2 = id2 && this.licenses.find(l => id2 === l.data.appEntitlementNumber);
      const license3 = id3 && this.licenses.find(l => id3 === l.data.addonLicenseId);

      verifyEqualLicenses(license1 || null, license2 || null);
      verifyEqualLicenses(license2 || null, license3 || null);

      // Check for transactions with missing licenses
      if (!transaction.license) {
        if (transaction.data.saleType === 'Refund') {
          refunds.add(transaction);
        }
        else {
          maybeRefunded.add(transaction);
        }
      }
    }

    // Warn when some transactions without matching licenses don't seem to be refunds
    const refundAmount = [...refunds].map(t => t.data.vendorAmount).reduce((a, b) => a + b, 0);
    const refundedAmount = [...maybeRefunded].map(t => t.data.vendorAmount).reduce((a, b) => a + b, 0);

    if (-refundAmount !== refundedAmount) {
      log.warn('Scoring Engine', "The following transactions have no accompanying licenses:");

      const sameById = (tx1: Transaction, tx2: Transaction, id: keyof TransactionData) => (
        tx1.data[id] && tx1.data[id] === tx2.data[id]
      );

      for (const refund of refunds) {
        const maybeMatch = [...maybeRefunded].find(maybeRefunded =>
          (
            sameById(refund, maybeRefunded, 'addonLicenseId') ||
            sameById(refund, maybeRefunded, 'appEntitlementId') ||
            sameById(refund, maybeRefunded, 'appEntitlementNumber')
          ) && maybeRefunded.data.vendorAmount === -refund.data.vendorAmount
        );
        if (maybeMatch) {
          refunds.delete(refund);
          maybeRefunded.delete(maybeMatch);
        }
      }

      if (refunds.size > 0) {
        Table.print({
          title: 'Refunds',
          log: s => log.warn('Scoring Engine', '  ' + s),
          cols: [
            [{ title: 'Transaction[License]', align: 'right' }, tx => tx.id],
            [{ title: 'Amount', align: 'right' }, tx => formatMoney(tx.data.vendorAmount)],
          ],
          rows: refunds,
        });
      }

      if (maybeRefunded.size > 0) {
        Table.print({
          title: 'Non-Refunds',
          log: s => log.warn('Scoring Engine', '  ' + s),
          cols: [
            [{ title: 'Transaction[License]', align: 'right' }, tx => tx.id],
            [{ title: 'Amount', align: 'right' }, tx => formatMoney(tx.data.vendorAmount)],
          ],
          rows: maybeRefunded,
        });
      }

      this.tallier.less('Ignored: Transactions without licenses', refundAmount + refundedAmount);
    }
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

function verifyIdIsUnique(licenses: License[], getter: (r: License) => string | null) {
  const ids = licenses.map(getter).filter(isPresent);
  const idSet = new Set(ids);
  if (ids.length !== idSet.size) {
    const idName = getter.toString().replace(/(\w+) => \1\.data\./, '');
    log.error('Database', 'License IDs not unique:', idName);
  }
}

function uniqueTransactionSetFrom(transactions: Transaction[]) {
  const set = new Set(transactions);
  if (set.size !== transactions.length) {
    log.error('Database', `Transactions aren't unique: got ${set.size} out of ${transactions.length}`);
  }
  return set;
}

function verifySameTransactionSet(set1: Set<Transaction> | null, set2: Set<Transaction> | null) {
  if (!set1 || !set2) return;

  const same = set1.size === set2.size && [...set1].every(t => set2.has(t));
  if (!same) {
    log.error('Database', `License IDs do not point to same transactions`);
  }
}

function verifyEqualLicenses(license1: License | null, license2: License | null) {
  if (!license1 || !license2) return;

  if (license1 !== license2) {
    log.error('Database', `License IDs do not point to same License from Transaction`);
  }
}
