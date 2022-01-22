import chalk from "chalk";
import DataDir from "../data/dir";
import HubspotAPI from "../io/hubspot";
import { Data } from '../io/interfaces';
import log from "../log/logger";
import { Table } from "../log/table";
import { Tallier } from "../log/tallier";
import { CompanyManager } from "../model/company";
import { ContactManager } from "../model/contact";
import { DealManager } from "../model/deal";
import { deriveMultiProviderDomainsSet } from "../model/email-providers";
import { License } from "../model/license";
import { getEmailsForRecord } from "../model/marketplace/common";
import { buildAndVerifyStructures } from "../model/marketplace/structure";
import * as validation from "../model/marketplace/validation";
import { Transaction } from "../model/transaction";
import { formatMoney, formatNumber } from "../util/formatters";
import { identifyAndFlagContactTypes } from "./contacts/contact-types";
import { ContactGenerator } from "./contacts/generate-contacts";
import { updateContactsBasedOnMatchResults } from "./contacts/update-contacts";
import { DealGenerator } from "./deal-generator/generate-deals";
import { LicenseGrouper } from "./license-matching/license-grouper";
import { printSummary } from "./summary";

export interface EngineConfig {
  partnerDomains: Set<string>;
  appToPlatform: { [addonKey: string]: string };
  archivedApps: Set<string>;
  ignoredEmails: Set<string>;
}

export class Engine {

  private step = 0;

  public dealManager: DealManager;
  public contactManager: ContactManager;
  public companyManager: CompanyManager;

  public licenses: License[] = [];
  public transactions: Transaction[] = [];

  public freeEmailDomains = new Set<string>();
  public partnerDomains = new Set<string>();
  public customerDomains = new Set<string>();

  public tallier = new Tallier();

  public appToPlatform: { [addonKey: string]: string } = Object.create(null);
  public archivedApps = new Set<string>();
  private ignoredEmails = new Set<string>();

  public constructor(outHubspot: HubspotAPI | null, config: EngineConfig | null) {
    this.dealManager = new DealManager(outHubspot);
    this.contactManager = new ContactManager(outHubspot);
    this.companyManager = new CompanyManager(outHubspot);

    if (config) {
      this.appToPlatform = config.appToPlatform;
      this.archivedApps = config.archivedApps;
      this.partnerDomains = config.partnerDomains;
      this.ignoredEmails = config.ignoredEmails;
    }
  }

  public async run(data: Data, logDir: DataDir | null) {
    this.logStep('Importing data into engine');
    this.importData(data);

    this.logStep('Identifying and Flagging Contact Types');
    identifyAndFlagContactTypes(this);

    this.logStep('Generating contacts');
    new ContactGenerator(this).run();

    this.logStep('Running Scoring Engine');
    const allMatches = new LicenseGrouper(this).run(logDir);

    this.logStep('Updating Contacts based on Match Results');
    updateContactsBasedOnMatchResults(this, allMatches);

    this.logStep('Generating deals');
    new DealGenerator(this).run(allMatches, logDir);

    this.logStep('Up-syncing to Hubspot');
    await this.syncUpAllEntities();

    printSummary(this);

    this.logStep('Done!');
  }

  private importData(data: Data) {
    const dealPrelinks = this.dealManager.importEntities(data.rawDeals);
    const companyPrelinks = this.companyManager.importEntities(data.rawCompanies);
    const contactPrelinks = this.contactManager.importEntities(data.rawContacts);

    this.dealManager.linkEntities(dealPrelinks, this);
    this.companyManager.linkEntities(companyPrelinks, this);
    this.contactManager.linkEntities(contactPrelinks, this);

    this.freeEmailDomains = deriveMultiProviderDomainsSet(data.freeDomains);

    const emailRe = new RegExp(`.+@.+\\.(${data.tlds.join('|')})`);
    const emailChecker = (kind: 'License' | 'Transaction') =>
      (record: License | Transaction) => {
        const allEmails = getEmailsForRecord(record);
        const allGood = allEmails.every(e => emailRe.test(e));
        if (!allGood && !allEmails.every(e => this.ignoredEmails.has(e.toLowerCase()))) {
          log.warn('Downloader', `${kind} has invalid email(s); will be skipped:`, record);
        }
        return allGood;
      };

    log.info('Database', 'Validating MPAC records: Starting...');

    const combinedLicenses = [
      ...data.licensesWithDataInsights,
      ...data.licensesWithoutDataInsights,
    ];

    let licenses = combinedLicenses.map(raw => License.fromRaw(raw));
    let transactions = data.transactions.map(raw => Transaction.fromRaw(raw));

    licenses = licenses.filter(validation.hasTechEmail);
    licenses = validation.removeApiBorderDuplicates(licenses);

    licenses.forEach(validation.assertRequiredLicenseFields);
    transactions.forEach(validation.assertRequiredTransactionFields);

    licenses = licenses.filter(emailChecker('License'));
    transactions = transactions.filter(emailChecker('Transaction'));

    const structured = buildAndVerifyStructures(licenses, transactions);
    this.licenses = structured.licenses;
    this.transactions = structured.transactions;

    log.info('Database', 'Validating MPAC records: Done');

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

  private logStep(description: string) {
    log.info('Marketing Automation', chalk.bold.blueBright(`Step ${++this.step}: ${description}`));
  }

}
