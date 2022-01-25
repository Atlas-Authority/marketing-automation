import chalk from "chalk";
import { Data } from "../data/set";
import { Hubspot } from "../hubspot";
import { CompanyManager } from "../hubspot/model/company";
import { ContactManager } from "../hubspot/model/contact";
import { DealManager } from "../hubspot/model/deal";
import { Logger } from "../log/logger";
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

  public tallier;

  public appToPlatform: { [addonKey: string]: string };
  public archivedApps: Set<string>;
  public dealPropertyConfig: DealPropertyConfig;
  private ignoredEmails: Set<string>;

  public dealManager: DealManager;
  public contactManager: ContactManager;
  public companyManager: CompanyManager;

  public constructor(private log: Logger | null, hubspotService: Hubspot, config: EngineConfig | null) {
    this.tallier = new Tallier(log);

    this.dealManager = hubspotService.dealManager;
    this.contactManager = hubspotService.contactManager;
    this.companyManager = hubspotService.companyManager;

    this.appToPlatform = config?.appToPlatform ?? Object.create(null);
    this.archivedApps = config?.archivedApps ?? new Set();
    this.partnerDomains = config?.partnerDomains ?? new Set();
    this.ignoredEmails = config?.ignoredEmails ?? new Set();
    this.dealPropertyConfig = config?.dealProperties ?? {
      dealDealName: 'Deal'
    };
  }

  public run(data: Data) {
    this.logStep('Importing given data set into engine');
    this.importData(data);

    this.logStep('Identifying and Flagging Contact Types');
    identifyAndFlagContactTypes(this);

    this.logStep('Generating contacts');
    new ContactGenerator(this).run();

    this.logStep('Running Scoring Engine');
    const allMatches = new LicenseGrouper(this.log, this).run();

    this.logStep('Updating Contacts based on Match Results');
    updateContactsBasedOnMatchResults(this, allMatches);

    this.logStep('Generating deals');
    new DealGenerator(this.log, this).run(allMatches);

    this.logStep('Summary');
    printSummary(this.log, this);

    this.logStep('Done running engine on given data set');
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
          this.log?.warn('Downloader', `${kind} has invalid email(s); will be skipped:`, record);
        }
        return allGood;
      };

    this.log?.info('Database', 'Validating MPAC records: Starting...');

    const combinedLicenses = [
      ...data.licensesWithDataInsights,
      ...data.licensesWithoutDataInsights,
    ];

    let licenses = combinedLicenses.map(raw => License.fromRaw(raw));
    let transactions = data.transactions.map(raw => Transaction.fromRaw(raw));

    licenses = licenses.filter(l => validation.hasTechEmail(this.log, l));
    licenses = validation.removeApiBorderDuplicates(licenses);

    licenses.forEach(validation.assertRequiredLicenseFields);
    transactions.forEach(validation.assertRequiredTransactionFields);

    licenses = licenses.filter(emailChecker('License'));
    transactions = transactions.filter(emailChecker('Transaction'));

    const structured = buildAndVerifyStructures(this.log, licenses, transactions);
    this.licenses = structured.licenses;
    this.transactions = structured.transactions;

    this.log?.info('Database', 'Validating MPAC records: Done');

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

    this.log?.info('Downloader', 'Download Summary');
    for (const row of table.eachRow()) {
      this.log?.info('Downloader', '  ' + row);
    }

  }

  private logStep(description: string) {
    this.log?.info('Engine', chalk.bold.blueBright(`Step ${++this.step}: ${description}`));
  }

}
