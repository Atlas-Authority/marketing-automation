import assert from "assert";
import { Engine } from "../engine";
import { RelatedLicenseSet } from "../license-matching/license-grouper";
import { Table } from "../log/table";
import { Deal } from "../model/deal";
import { License, LicenseData } from "../model/license";
import { Transaction } from "../model/transaction";
import { formatMoney } from "../util/formatters";
import { isPresent, sorter, withAutoClose } from "../util/helpers";
import { Action, ActionGenerator } from "./actions";
import { DealRelevantEvent, EventGenerator } from "./events";


export type IgnoredLicense = LicenseData & {
  reason: string;
  details: string;
};

interface DealGeneratorResult {
  records: (License | Transaction)[];
  events: DealRelevantEvent[];
  actions: Action[];
}

/** Generates deal actions based on match data */
export class DealGenerator {

  private actionGenerator: ActionGenerator;

  private ignoredAmounts = new Map<string, number>();

  public constructor(private engine: Engine) {
    this.actionGenerator = new ActionGenerator(
      engine.dealManager,
      engine.dealPropertyConfig,
      this.ignore.bind(this),
      engine.log?.consoleLogger,
    );
  }

  public run(matchGroups: RelatedLicenseSet[]) {
    return withAutoClose(this.engine.log?.dealGeneratorLog(), logger => {
      const results = new Map<string, DealGeneratorResult>();

      for (const relatedLicenses of matchGroups) {
        const { records, events, actions } = this.generateActionsForMatchedGroup(relatedLicenses);

        logger?.logRecords(records);
        logger?.logEvents(events);
        logger?.logActions(actions);

        for (const license of relatedLicenses) {
          results.set(license.id, { records, events, actions })
        }

        for (const action of actions) {
          const deal = (action.type === 'create'
            ? this.engine.dealManager.create(action.properties)
            : action.deal);

          if (deal) {
            this.associateDealContactsAndCompanies(relatedLicenses, deal);
          }
        }
      }

      for (const [reason, amount] of this.ignoredAmounts) {
        this.engine.tallier.less('Ignored: ' + reason, amount);
      }

      this.printIgnoredTransactionsTable();

      return results;
    });
  }

  private printIgnoredTransactionsTable() {
    const table = new Table([
      { title: 'Reason Ignored' },
      { title: 'Amount Ignored', align: 'right' },
    ]);
    for (const [reason, amount] of this.ignoredAmounts) {
      table.rows.push([reason, formatMoney(amount)]);
    }

    this.engine.log?.consoleLogger.printInfo('Deal Actions', 'Amount of Transactions Ignored');
    for (const row of table.eachRow()) {
      this.engine.log?.consoleLogger.printInfo('Deal Actions', '  ' + row);
    }
  }

  private generateActionsForMatchedGroup(group: RelatedLicenseSet) {
    assert.ok(group.length > 0);

    const eventGenerator = new EventGenerator(this.engine);

    const records = eventGenerator.getSortedRecords(group);
    const events = eventGenerator.interpretAsEvents(records);
    const actions = this.actionGenerator.generateFrom(records, events);

    return { records, events, actions };
  }

  private associateDealContactsAndCompanies(group: RelatedLicenseSet, deal: Deal) {
    const records = group.flatMap(license => [license, ...license.transactions]);
    const emails = [...new Set(records.flatMap(r => r.allContacts.map(c => c.data.email)))];
    const contacts = (emails
      .map(email => this.engine.contactManager.getByEmail(email))
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

  private ignore(reason: string, amount: number) {
    const oldAmount = this.ignoredAmounts.get(reason) ?? 0;
    this.ignoredAmounts.set(reason, oldAmount + amount);
  }

}
