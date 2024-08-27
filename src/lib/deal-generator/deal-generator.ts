import assert from "assert";
import { Engine } from "../engine/engine";
import { RelatedLicenseSet } from "../license-matching/license-grouper";
import { Table } from "../log/table";
import { Deal } from "../model/deal";
import { License, LicenseData } from "../model/license";
import { Transaction } from "../model/transaction";
import { formatMoney } from "../util/formatters";
import { isPresent, sorter, withAutoClose } from "../util/helpers";
import { Action, ActionGenerator } from "./actions";
import { DealRelevantEvent, EventGenerator } from "./events";
import {BlockingDeal} from '../util/errors'


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
      engine.hubspot.dealManager,
      engine.dealPropertyConfig,
      (reason, amount) => this.ignore(reason, amount),
      engine.console,
    );
  }

  public run(matchGroups: RelatedLicenseSet[]) {
    return withAutoClose(this.engine.logDir?.dealGeneratorLog(), logger => {
      const results = new Map<string, DealGeneratorResult>();

      for (const relatedLicenses of matchGroups) {
        try {
          const { records, events, actions } = this.generateActionsForMatchedGroup(relatedLicenses);

          logger?.logRecords(records);
          logger?.logEvents(events);
          logger?.logActions(actions);

          for (const license of relatedLicenses) {
            results.set(license.id, { records, events, actions })
          }

          for (const action of actions) {
            const deal = (action.type === 'create'
              ? this.engine.hubspot.dealManager.create(action.properties)
              : action.deal);

            if (deal) {
              this.associateDealContactsAndCompanies(relatedLicenses, deal);
            }
          }
        } catch (error: unknown) {
          if (error instanceof BlockingDeal) {
            this.engine.console?.printError('Deal Generator', 'Blocking deal detected', {
              deal: {
                id: error.deal.id,
                data: error.deal.data
              }
            })
          } else {
            throw error;
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

    this.engine.console?.printInfo('Deal Actions', 'Amount of Transactions Ignored');
    for (const row of table.eachRow()) {
      this.engine.console?.printInfo('Deal Actions', '  ' + row);
    }
  }

  private generateActionsForMatchedGroup(group: RelatedLicenseSet) {
    assert.ok(group.length > 0);

    const eventGenerator = new EventGenerator(
      this.engine.archivedApps,
      this.engine.partnerDomains,
      this.engine.freeEmailDomains,
      this.engine.console
    );

    const records = eventGenerator.getSortedRecords(group);
    const events = eventGenerator.interpretAsEvents(records);
    const actions = this.actionGenerator.generateFrom(records, events);

    return { records, events, actions };
  }

  private associateDealContactsAndCompanies(group: RelatedLicenseSet, deal: Deal) {
    const records = group.flatMap(license => [license, ...license.transactions]);
    const emails = [...new Set(records.flatMap(r => r.allContacts.map(c => c.data.email)))];
    const contacts = (emails
      .map(email => this.engine.hubspot.contactManager.getByEmail(email))
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
