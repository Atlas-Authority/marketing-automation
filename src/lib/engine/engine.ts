import chalk from "chalk";
import { ContactGenerator } from "../contact-generator/contact-generator";
import { ContactTypeFlagger } from "../contact-generator/contact-types";
import { updateContactsBasedOnMatchResults } from "../contact-generator/update-contacts";
import { DataSet } from "../data/set";
import { DealGenerator } from "../deal-generator/deal-generator";
import { Hubspot } from "../hubspot/hubspot";
import { LicenseGrouper } from "../license-matching/license-grouper";
import { ConsoleLogger } from "../log/console";
import { LogDir } from "../log/logdir";
import { Table } from "../log/table";
import { Tallier } from "../log/tallier";
import { Marketplace } from "../marketplace/marketplace";
import { formatMoney, formatNumber } from "../util/formatters";
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
  dealProperties?: DealPropertyConfig;
}

export class Engine {

  private step = 0;

  public partnerDomains = new Set<string>();
  private customerDomains = new Set<string>();

  public tallier;

  public appToPlatform: { [addonKey: string]: string };
  public archivedApps: Set<string>;
  public dealPropertyConfig: DealPropertyConfig;

  public hubspot!: Hubspot;
  public mpac!: Marketplace;
  public freeEmailDomains!: Set<string>;

  public constructor(config?: EngineConfig, public console?: ConsoleLogger, public logDir?: LogDir) {
    this.tallier = new Tallier(console);

    this.appToPlatform = config?.appToPlatform ?? Object.create(null);
    this.archivedApps = config?.archivedApps ?? new Set();
    this.partnerDomains = config?.partnerDomains ?? new Set();
    this.dealPropertyConfig = config?.dealProperties ?? {
      dealDealName: 'Deal'
    };
  }

  public run(data: DataSet) {
    this.hubspot = data.hubspot;
    this.mpac = data.mpac;
    this.freeEmailDomains = data.freeEmailDomains;

    if (process.env['HUBSPOT_API_KEY']) {
      this.console?.printWarning('Deprecation Notice', 'HUBSPOT_API_KEY is deprecated. See changelog for details.');
    }

    this.logStep('Starting engine');
    this.startEngine();

    this.logStep('Identifying and Flagging Contact Types');
    const contactTypeFlagger = new ContactTypeFlagger(
      this.mpac.licenses,
      this.mpac.transactions,
      this.hubspot.contactManager,
      this.freeEmailDomains,
      this.partnerDomains,
      this.customerDomains,
    );
    contactTypeFlagger.identifyAndFlagContactTypes();

    this.logStep('Generating contacts');
    const contactGenerator = new ContactGenerator(
      this.mpac.licenses,
      this.mpac.transactions,
      this.hubspot.contactManager,
      this.partnerDomains,
      this.archivedApps,
    );
    contactGenerator.run();

    this.logStep('Running Scoring Engine');
    const licenseGrouper = new LicenseGrouper(
      this.freeEmailDomains,
      this.console,
      this.logDir,
    );
    const allMatches = licenseGrouper.run(this.mpac.licenses);

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

  private startEngine() {
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
