import DataDir from "../../cache/datadir";
import { Table } from "../../log/table";
import { DealData} from "../../model/deal";
import { DealStage, FullEntity } from '../../model/hubspot/interfaces';
import { License } from "../../model/license";
import { Transaction, uniqueTransactionId } from "../../model/transaction";
import { formatMoney } from "../../util/formatters";
import { Action } from "./actions";
import { DealRelevantEvent } from "./events";
import { RelatedLicenseSet } from "../license-matching/license-grouper";

export class DealDataLogger {

  private readonly log = DataDir.out.file('deal-generator.txt').writeStream();
  private readonly jsonLog = DataDir.out.file('deal-generator-json.txt').jsonWriteStream();

  close() {
    this.log.close();
  }

  logRawDeals(dealsFetcher: () => FullEntity[]) {
    this.log.writeLine('Deals');
    if(this.log.enabled) {
      const deals = dealsFetcher();
      for (const deal of deals) {
        this.log.writeLine(`Deal #${deal.id}`);
        this.printDealProperties(deal.properties);
      }
    }
    this.log.writeLine();

    // Json log
    this.jsonLog.writeLine('Deals');
    if (this.jsonLog.enabled) {
      const deals = dealsFetcher();
      this.jsonLog.writeJson(deals);
    }
    this.jsonLog.writeLine();
  }

  logActions(actions: Action[]) {
    this.log.writeLine('Actions');
    for (const action of actions) {
      switch (action.type) {
        case 'create': {
          this.log.writeLine('  Create:');
          this.printDealProperties(action.properties);
          break;
        }
        case 'update': {
          const dealId = action.deal.id;
          this.log.writeLine(`  Update: ${dealId}`);
          this.printDealProperties(action.properties);
          break;
        }
        case 'noop': {
          const dealId = action.deal.id;
          const { amount, addonLicenseId, transactionId, dealStage } = action.deal.data;
          const recordId = (transactionId
            ? uniqueTransactionId({ transactionId, addonLicenseId })
            : addonLicenseId
          );
          const stage = DealStage[dealStage];
          this.log.writeLine(`  Nothing: ${dealId}, via ${recordId}, stage=${stage}, amount=${amount}`);
          break;
        }
      }
    }
    this.log.writeLine();

    // Json log
    this.jsonLog.writeLine('Actions');
    const actionsLog = actions.map(action => ({
      type: action.type,
      properties: action.type === 'noop' ? action.deal.data : action.properties,
    }));
    this.jsonLog.writeJson(actionsLog);
    this.jsonLog.writeLine()
  }

  private printDealProperties(data: Partial<DealData>) {
    for (const [k, v] of Object.entries(data)) {
      this.log.writeLine(`    ${k}: ${v}`);
    }
  }

  logRecords(relatedLicenseSet: RelatedLicenseSet) {
    this.log.writeLine('Related License Set');
    for(const licenseContext of relatedLicenseSet) {
      this.logLicense(licenseContext.license);
      this.logTransactions(licenseContext.transactions);
      this.log.writeLine();
    }

    // Json log
    this.jsonLog.writeLine('Related License Set');
    this.jsonLog.writeJson(relatedLicenseSet);
    this.jsonLog.writeLine();
  }

  logLicense(license: License) {
    this.log.writeLine();
    Table.print({
      log: str => this.log.writeLine(str),
      title: 'License',
      rows: [license],
      cols: [
        [{ title: 'Hosting' }, license => license.data.hosting],
        [{ title: 'AddonLicenseId' }, license => license.data.addonLicenseId],
        [{ title: 'Date' }, license => license.data.maintenanceStartDate],
        [{ title: 'LicenseType' }, license => license.data.licenseType],
      ],
    });
  }

  logTransactions(transactions: Transaction[]) {
    this.log.writeLine();
    Table.print({
      log: str => this.log.writeLine(str),
      title: 'Transactions',
      rows: transactions,
      cols: [
        [{ title: 'Hosting' }, transaction => transaction.data.hosting],
        [{ title: 'AddonLicenseId' }, transaction => transaction.data.addonLicenseId],
        [{ title: 'Date' }, transaction => transaction.data.maintenanceStartDate],
        [{ title: 'LicenseType' }, transaction => transaction.data.licenseType],
        [{ title: 'SaleType' }, transaction => transaction.data.saleType],
        [{ title: 'Transaction' }, transaction => transaction.data.transactionId],
        [{ title: 'Amount', align: 'right' }, transaction => formatMoney(transaction.data.vendorAmount)],
      ],
    });
  }

  logEvents(events: DealRelevantEvent[]) {
    const rows = events.map(e => {
      switch (e.type) {
        case 'eval': return {
          type: e.type,
          lics: e.licenses.map(l => l.id),
          txs: [],
        };
        case 'purchase': return {
          type: e.type,
          lics: e.licenses.map(l => l.id),
          txs: [e.transaction?.id],
        };
        case 'refund': return {
          type: e.type,
          lics: [],
          txs: e.refundedTxs.map(tx => tx.id),
        };
        case 'renewal': return {
          type: e.type,
          lics: [],
          txs: [e.transaction.id],
        };
        case 'upgrade': return {
          type: e.type,
          lics: [],
          txs: [e.transaction.id],
        };
      }
    });

    Table.print({
      title: 'Events',
      log: str => this.log.writeLine(str),
      rows: rows,
      cols: [
        [{ title: 'Type' }, row => row.type],
        [{ title: 'Licenses' }, row => row.lics?.join(', ') ?? ''],
        [{ title: 'Transactions' }, row => row.txs?.join(', ') ?? ''],
      ],
    });
    this.log.writeLine();

    // Json log
    this.jsonLog.writeLine('Events');
    this.jsonLog.writeJson(rows);
    this.jsonLog.writeLine();
  }

}

export const actionStringifyReplacer = (key: string, value: any) => {
  return key === 'deal' ? value?.id : value;
}
