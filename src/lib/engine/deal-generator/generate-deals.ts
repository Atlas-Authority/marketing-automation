import * as assert from 'assert';
import DataDir, { LogWriteStream } from '../../cache/datadir.js';
import { saveForInspection } from '../../cache/inspection.js';
import log from '../../log/logger.js';
import { Table } from '../../log/table.js';
import { Database } from '../../model/database.js';
import { Deal } from '../../model/deal.js';
import { License, LicenseData } from '../../model/license.js';
import { Transaction } from '../../model/transaction.js';
import env from '../../parameters/env.js';
import { formatMoney } from '../../util/formatters.js';
import { isPresent, sorter } from '../../util/helpers.js';
import { RelatedLicenseSet } from '../license-matching/license-grouper.js';
import { abbrActionDetails, ActionGenerator } from './actions.js';
import { EventGenerator } from './events.js';
import { getEmails } from './records.js';

export type IgnoredLicense = LicenseData & {
  reason: string;
  details: string;
};

/** Generates deal actions based on match data */
export class DealGenerator {

  private actionGenerator: ActionGenerator;

  private ignoredLicenseSets: (IgnoredLicense)[][] = [];
  private ignoredAmounts = new Map<string, number>();

  private partnerTransactions = new Set<Transaction>();

  public constructor(private db: Database) {
    this.actionGenerator = new ActionGenerator(db.dealManager);
  }

  public run(matches: RelatedLicenseSet[]) {
    const dealGeneratorLog = DataDir.out.file('deal-generator.txt').writeStream();

    for (const relatedLicenseIds of matches) {
      const actions = this.generateActionsForMatchedGroup(dealGeneratorLog, relatedLicenseIds);
      for (const action of actions) {
        const deal = (action.type === 'create'
          ? this.db.dealManager.create(action.properties)
          : action.deal);

        this.associateDealContactsAndCompanies(action.groups, deal);
      }
    }

    saveForInspection('ignored', this.ignoredLicenseSets);

    for (const [reason, amount] of this.ignoredAmounts) {
      this.db.tallier.less('Ignored: ' + reason, amount);
    }

    this.printIgnoredTransactionsTable();
    this.printPartnerTransactionsTable();

    dealGeneratorLog.close();
  }

  private printIgnoredTransactionsTable() {
    const table = new Table([
      { title: 'Reason Ignored' },
      { title: 'Amount Ignored', align: 'right' },
    ]);
    for (const [reason, amount] of this.ignoredAmounts) {
      table.rows.push([reason, formatMoney(amount)]);
    }

    log.info('Deal Actions', 'Amount of Transactions Ignored');
    for (const row of table.eachRow()) {
      log.info('Deal Actions', '  ' + row);
    }
  }

  private printPartnerTransactionsTable() {
    const table = new Table([
      { title: 'Transaction' },
      { title: 'SEN' },
      { title: 'AddonLicId' },
      { title: 'Sale Date' },
      { title: 'Amount', align: 'right' },
      { title: 'Emails used' },
    ]);
    for (const t of this.partnerTransactions) {
      table.rows.push([
        t.data.transactionId,
        t.data.licenseId,
        t.data.addonLicenseId,
        t.data.saleDate,
        formatMoney(t.data.vendorAmount),
        [...new Set(getEmails(t))].join(', '),
      ]);
    }

    log.warn('Deal Actions', 'Partner amounts');
    for (const row of table.eachRow()) {
      log.warn('Deal Actions', '  ' + row);
    }
  }

  private generateActionsForMatchedGroup(dealGeneratorLog: LogWriteStream, groups: RelatedLicenseSet) {
    assert.ok(groups.length > 0);
    if (this.ignoring(groups)) return [];

    const events = new EventGenerator(dealGeneratorLog).interpretAsEvents(groups);
    const actions = this.actionGenerator.generateFrom(events);

    dealGeneratorLog.writeLine(JSON.stringify(actions.map(action => abbrActionDetails(action))));

    return actions;
  }

  private associateDealContactsAndCompanies(groups: RelatedLicenseSet, deal: Deal) {
    const records = groups.flatMap(group => [group.license, ...group.transactions]);
    const emails = [...new Set(records.flatMap(getEmails))];
    const contacts = (emails
      .map(email => this.db.contactManager.getByEmail(email))
      .filter(isPresent));
    contacts.sort(sorter(c => c.isCustomer ? -1 : 0));

    const companies = (contacts
      .filter(c => c.isCustomer)
      .flatMap(c => c.companies.getAll()));

    deal.contacts.clear();
    for (const contact of contacts) {
      deal.contacts.add(contact);
    }

    deal.companies.clear();
    for (const company of companies) {
      deal.companies.add(company);
    }
  }

  /** Ignore if every license's tech contact domain is partner or mass-provider */
  private ignoring(groups: RelatedLicenseSet) {
    const licenses = groups.map(g => g.license);
    const transactions = groups.flatMap(g => g.transactions);
    const records = [...licenses, ...transactions];
    const domains = new Set(records.map(license => license.data.technicalContact.email.toLowerCase().split('@')[1]));

    if (records.every(r => hasIgnoredApp(r.data))) {
      this.ignoreLicenses("Archived app", records[0].data.addonKey, licenses, transactions);
      return true;
    }

    const partnerDomains = [...domains].filter(domain => this.db.partnerDomains.has(domain));
    const providerDomains = [...domains].filter(domain => this.db.providerDomains.has(domain));

    if (domains.size == partnerDomains.length + providerDomains.length) {
      let reason;
      if (partnerDomains.length > 0) {
        reason = 'Partner Domains';
        for (const tx of transactions) {
          this.partnerTransactions.add(tx);
        }
      }
      else if (providerDomains.length > 0) {
        reason = 'Mass-Provider Domains';
      }
      else {
        reason = 'Unknown domain issue';
      }

      this.ignoreLicenses(reason, [...domains].join(','), licenses, transactions);
      return true;
    }

    return false;
  }

  private ignoreLicenses(reason: string, details: string, licenses: License[], transactions: Transaction[]) {
    const ignoringAmount = (transactions
      .map(t => t.data.vendorAmount)
      .reduce((a, b) => a + b, 0));

    this.ignoredAmounts.set(reason,
      (this.ignoredAmounts.get(reason) ?? 0) +
      ignoringAmount);

    this.ignoredLicenseSets.push(licenses.map(license => ({
      reason,
      details,
      ...license.data,
    })));
  }

}

function hasIgnoredApp(record: { addonKey: string }) {
  return env.engine.ignoredApps.has(record.addonKey);
}
