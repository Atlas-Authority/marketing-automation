import chalk from "chalk";
import { ContactGenerator } from "../contact-generator";
import { identifyAndFlagContactTypes } from "../contact-generator/contact-types";
import { updateContactsBasedOnMatchResults } from "../contact-generator/update-contacts";
import { Data } from "../data/set";
import { DealGenerator } from "../deal-generator";
import { Hubspot } from "../hubspot";
import { LicenseGrouper } from "../license-matching/license-grouper";
import { LogDir } from "../log";
import { ConsoleLogger } from "../log/console";
import { Table } from "../log/table";
import { Tallier } from "../log/tallier";
import { Marketplace } from "../marketplace";
import { formatMoney, formatNumber } from "../util/formatters";
import { deriveMultiProviderDomainsSet } from "./all-free-email-providers";
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

  public mpac;

  public freeEmailDomains = new Set<string>();
  public partnerDomains = new Set<string>();
  public customerDomains = new Set<string>();

  public tallier;

  public appToPlatform: { [addonKey: string]: string };
  public archivedApps: Set<string>;
  public dealPropertyConfig: DealPropertyConfig;

  public constructor(public hubspot: Hubspot, config?: EngineConfig, public console?: ConsoleLogger, public logDir?: LogDir) {
    this.tallier = new Tallier(console);
    this.mpac = new Marketplace(config);

    this.appToPlatform = config?.appToPlatform ?? Object.create(null);
    this.archivedApps = config?.archivedApps ?? new Set();
    this.partnerDomains = config?.partnerDomains ?? new Set();
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
    this.freeEmailDomains = deriveMultiProviderDomainsSet(data.freeDomains);
    this.hubspot.importData(data);
    this.mpac.importData(data);

    const transactionTotal = (this.mpac.transactions
      .map(t => t.data.vendorAmount)
      .reduce((a, b) => a + b, 0));

    this.printDownloadSummary(transactionTotal);

    this.tallier.first('Transaction total', transactionTotal);
  }

  private printDownloadSummary(transactionTotal: number) {
    const deals = this.hubspot.dealManager.getArray();
    const dealSum = (deals
      .map(d => d.data.amount ?? 0)
      .reduce((a, b) => a + b, 0));

    const contacts = this.hubspot.contactManager.getArray();

    const table = new Table([{}, { align: 'right' }]);
    table.rows.push(['# Licenses', formatNumber(this.mpac.licenses.length)]);
    table.rows.push(['# Transactions', formatNumber(this.mpac.transactions.length)]);
    table.rows.push(['$ Transactions', formatMoney(transactionTotal)]);
    table.rows.push(['# Contacts', formatNumber(contacts.length)]);
    table.rows.push(['# Deals', formatNumber(deals.length)]);
    table.rows.push(['$ Deals', formatMoney(dealSum)]);

    this.console?.printInfo('Downloader', 'Download Summary');
    for (const row of table.eachRow()) {
      this.console?.printInfo('Downloader', '  ' + row);
    }

  }

  private logStep(description: string) {
    this.console?.printInfo('Engine', chalk.bold.blueBright(`Step ${++this.step}: ${description}`));
  }

}
