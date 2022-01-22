import chalk from "chalk";
import DataDir from "../data/dir";
import { Data } from "../data/set";
import { HubspotService } from "../hubspot/service";
import log from "../log/logger";
import { Table } from "../log/table";
import { Tallier } from "../log/tallier";
import { License } from "../marketplace/model/license";
import { getEmailsForRecord } from "../marketplace/model/record";
import { Transaction } from "../marketplace/model/transaction";
import { buildAndVerifyStructures } from "../marketplace/structure";
import * as validation from "../marketplace/validation";
import { formatMoney, formatNumber } from "../util/formatters";
import { deriveMultiProviderDomainsSet } from "./all-free-email-providers";
import { identifyAndFlagContactTypes } from "./contacts/contact-types";
import { ContactGenerator } from "./contacts/generate-contacts";
import { updateContactsBasedOnMatchResults } from "./contacts/update-contacts";
import { DealGenerator } from "./deal-generator/generate-deals";
import { LicenseGrouper } from "./license-matching/license-grouper";
import { printSummary } from "./summary";

export type DealPropertyConfig = {
  dealOrigin?: string;
  dealRelatedProducts?: string;
  dealDealName: string;
};

export interface EngineConfig {
  partnerDomains?: Set<string>;
  appToPlatform?: { [addonKey: string]: string };
  archivedApps?: Set<string>;
  ignoredEmails?: Set<string>;
  dealProperties?: DealPropertyConfig;
}

export class Engine {

  private step = 0;

  public licenses: License[] = [];
  public transactions: Transaction[] = [];

  public freeEmailDomains = new Set<string>();
  public partnerDomains = new Set<string>();
  public customerDomains = new Set<string>();

  public tallier = new Tallier();

  public appToPlatform: { [addonKey: string]: string };
  public archivedApps: Set<string>;
  public dealPropertyConfig: DealPropertyConfig;
  private ignoredEmails: Set<string>;

  public constructor(private hubspotService: HubspotService, config: EngineConfig | null) {
    this.appToPlatform = config?.appToPlatform ?? Object.create(null);
    this.archivedApps = config?.archivedApps ?? new Set();
    this.partnerDomains = config?.partnerDomains ?? new Set();
    this.ignoredEmails = config?.ignoredEmails ?? new Set();
    this.dealPropertyConfig = config?.dealProperties ?? {
      dealDealName: 'Deal'
    };
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

    this.logStep('Summary');
    printSummary(this);

    this.logStep('Up-syncing to Hubspot');
    await this.syncUpAllEntities();

    this.logStep('Done!');
  }

  private importData(data: Data) {
    const dealPrelinks = this.hubspotService.dealManager.importEntities(data.rawDeals);
    const companyPrelinks = this.hubspotService.companyManager.importEntities(data.rawCompanies);
    const contactPrelinks = this.hubspotService.contactManager.importEntities(data.rawContacts);

    this.hubspotService.dealManager.linkEntities(dealPrelinks, this.hubspotService);
    this.hubspotService.companyManager.linkEntities(companyPrelinks, this.hubspotService);
    this.hubspotService.contactManager.linkEntities(contactPrelinks, this.hubspotService);

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
    const deals = this.hubspotService.dealManager.getArray();
    const dealSum = (deals
      .map(d => d.data.amount ?? 0)
      .reduce((a, b) => a + b, 0));

    const contacts = this.hubspotService.contactManager.getArray();

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
    await this.hubspotService.dealManager.syncUpAllEntities();
    await this.hubspotService.contactManager.syncUpAllEntities();
    await this.hubspotService.companyManager.syncUpAllEntities();

    await this.hubspotService.dealManager.syncUpAllAssociations();
    await this.hubspotService.contactManager.syncUpAllAssociations();
    await this.hubspotService.companyManager.syncUpAllAssociations();
  }

  private logStep(description: string) {
    log.info('Marketing Automation', chalk.bold.blueBright(`Step ${++this.step}: ${description}`));
  }

  get contactManager() { return this.hubspotService.contactManager; }
  get dealManager() { return this.hubspotService.dealManager; }
  get companyManager() { return this.hubspotService.companyManager; }

}
