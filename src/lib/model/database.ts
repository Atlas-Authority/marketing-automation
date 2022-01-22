import HubspotAPI from "../io/hubspot";
import { Data } from '../io/interfaces';
import { makeEmailValidationRegex } from "../io/tlds";
import log from "../log/logger";
import { Table } from "../log/table";
import { Tallier } from "../log/tallier";
import env, { Config } from "../parameters/env-config";
import { formatMoney, formatNumber } from "../util/formatters";
import { CompanyManager } from "./company";
import { ContactManager } from "./contact";
import { DealManager } from "./deal";
import { deriveMultiProviderDomainsSet } from "./email-providers";
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

  public tallier = new Tallier();

  public appToPlatform: { [addonKey: string]: string } = Object.create(null);
  public archivedApps = new Set<string>();

  public constructor(outHubspot: HubspotAPI | null, config: Config, populateFromEnv = true) {
    this.dealManager = new DealManager(outHubspot);
    this.contactManager = new ContactManager(outHubspot);
    this.companyManager = new CompanyManager(outHubspot);

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

  importData(data: Data) {
    const getManager = (kind: EntityKind) => {
      switch (kind) {
        case 'deal': return this.dealManager;
        case 'company': return this.companyManager;
        case 'contact': return this.contactManager;
      }
    };

    const getEntity = (kind: EntityKind, id: string): Entity<any, any> => {
      const found = getManager(kind).get(id);
      // There's only two ways to set associations:
      // 1. They were already set in HubSpot when we downloaded them, or
      // 2. We set them in code with an object already having a valid id.
      // In either case, an invalid id would fail before this method.
      if (!found) throw new Error(`Expected to find ${kind} with id ${id}`);
      return found;
    };

    const dealPrelinks = this.dealManager.importEntities(data.rawDeals);
    const companyPrelinks = this.companyManager.importEntities(data.rawCompanies);
    const contactPrelinks = this.contactManager.importEntities(data.rawContacts);

    this.dealManager.linkEntities(dealPrelinks, { getEntity });
    this.companyManager.linkEntities(companyPrelinks, { getEntity });
    this.contactManager.linkEntities(contactPrelinks, { getEntity });

    this.providerDomains = deriveMultiProviderDomainsSet(data.freeDomains);

    const emailRe = makeEmailValidationRegex(data.tlds);

    log.info('Database', 'Validating MPAC records: Starting...');
    const results = validateMarketplaceData({
      licenses: [
        ...data.licensesWithDataInsights,
        ...data.licensesWithoutDataInsights,
      ].map(raw => License.fromRaw(raw)),
      transactions: data.transactions.map(raw => Transaction.fromRaw(raw)),
      emailRe,
    });
    log.info('Database', 'Validating MPAC records: Done');

    this.licenses = results.licenses;
    this.transactions = results.transactions;

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

}
