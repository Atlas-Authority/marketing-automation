import DataDir from "../../cache/datadir.js";
import { Table } from "../../log/table.js";
import { DealData } from "../../model/deal.js";
import { DealStage } from '../../model/hubspot/interfaces.js';
import { License } from "../../model/license.js";
import { Transaction, uniqueTransactionId } from "../../model/transaction.js";
import { formatMoney } from "../../util/formatters.js";
import { RelatedLicenseSet } from "../license-matching/license-grouper.js";
import { Action } from "./actions.js";
import { DealRelevantEvent } from "./events.js";

export class DealDataLogger {

  private readonly log = DataDir.out.file('deal-generator.txt').writeStream();

  close() {
    this.log.close();
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
          const { amount: realAmount, addonLicenseId, transactionId, dealStage } = action.deal.data;
          const recordId = (transactionId
            ? uniqueTransactionId({ transactionId, addonLicenseId })
            : addonLicenseId
          );
          const amount = realAmount;
          const stage = DealStage[dealStage];
          this.log.writeLine(`  Nothing: ${dealId}, via ${recordId}, stage=${stage}, amount=${amount}`);
          break;
        }
      }
    }
  }

  private printDealProperties(data: Partial<DealData>) {
    for (const [k, v] of Object.entries(data)) {
      this.log.writeLine(`    ${k}: ${v}`);
    }
  }

  public logTestID(groups: RelatedLicenseSet) {
    const ids = groups.map(g => [g.license.id, g.transactions.map(t => t.id)]);
    this.log.writeLine('\n');
    this.log.writeLine(Buffer.from(JSON.stringify(ids), 'utf8').toString('base64'));
  }

  logRecords(records: (License | Transaction)[]) {
    const ifTx = (fn: (r: Transaction) => string) =>
      (r: License | Transaction) =>
        r instanceof Transaction ? fn(r) : '';

    Table.print({
      log: str => this.log.writeLine(str),
      title: 'Records',
      rows: records,
      cols: [
        [{ title: 'Hosting' }, record => record.data.hosting],
        [{ title: 'AddonLicenseId' }, record => record.data.addonLicenseId],
        [{ title: 'Date' }, record => record.data.maintenanceStartDate],
        [{ title: 'LicenseType' }, record => record.data.licenseType],
        [{ title: 'SaleType' }, ifTx(record => record.data.saleType)],
        [{ title: 'Transaction' }, ifTx(record => record.data.transactionId)],
        [{ title: 'Amount', align: 'right' }, ifTx(record => formatMoney(record.data.vendorAmount))],
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
  }

}
