import chalk from "chalk";
import { Data } from "../data/set";
import { Hubspot } from "../hubspot";
import { Logger } from "../log";
import { Table } from "../log/table";
import { Tallier } from "../log/tallier";
import { buildAndVerifyStructures } from "../marketplace/structure";
import * as validation from "../marketplace/validation";
import { CompanyManager } from "../model/company";
import { ContactManager } from "../model/contact";
import { DealManager } from "../model/deal";
import { License } from "../model/license";
import { getEmailsForRecord } from "../model/record";
import { Transaction } from "../model/transaction";
import { formatMoney, formatNumber } from "../util/formatters";
import { deriveMultiProviderDomainsSet } from "./all-free-email-providers";
import { ContactGenerator } from "./contact-generator";
import { identifyAndFlagContactTypes } from "./contact-generator/contact-types";
import { updateContactsBasedOnMatchResults } from "./contact-generator/update-contacts";
import { DealGenerator } from "./deal-generator";
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

  public constructor(hubspotService: Hubspot, config?: EngineConfig, public log?: Logger) {
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
    const allMatches = new LicenseGrouper(this).run();

    this.logStep('Updating Contacts based on Match Results');
    updateContactsBasedOnMatchResults(this, allMatches);

    this.logStep('Generating deals');
    const dealGenerator = new DealGenerator(this);
    const dealGeneratorResults = dealGenerator.run(allMatches);

    this.logStep('Summary');
    printSummary(this);

    this.logStep('Done running engine on given data set');

    return { dealGeneratorResults };
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
          this.log?.printWarning('Downloader', `${kind} has invalid email(s); will be skipped:`, record);
        }
        return allGood;
      };

    this.log?.printInfo('Database', 'Validating MPAC records: Starting...');

    const combinedLicenses = [
      ...data.licensesWithDataInsights,
      ...data.licensesWithoutDataInsights,
    ];

    let licenses = combinedLicenses.map(raw => License.fromRaw(raw));
    let transactions = data.transactions.map(raw => Transaction.fromRaw(raw));

    licenses = licenses.filter(l => validation.hasTechEmail(l, this.log));
    licenses = validation.removeApiBorderDuplicates(licenses);

    licenses.forEach(validation.assertRequiredLicenseFields);
    transactions.forEach(validation.assertRequiredTransactionFields);

    licenses = licenses.filter(emailChecker('License'));
    transactions = transactions.filter(emailChecker('Transaction'));

    const structured = buildAndVerifyStructures(licenses, transactions, this.log);
    this.licenses = structured.licenses;
    this.transactions = structured.transactions;

    this.log?.printInfo('Database', 'Validating MPAC records: Done');

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

    this.log?.printInfo('Downloader', 'Download Summary');
    for (const row of table.eachRow()) {
      this.log?.printInfo('Downloader', '  ' + row);
    }

  }

  private logStep(description: string) {
    this.log?.printInfo('Engine', chalk.bold.blueBright(`Step ${++this.step}: ${description}`));
  }

}
