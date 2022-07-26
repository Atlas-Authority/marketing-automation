import { LogWriteStream } from "../data/file.js";
import { Action } from "../deal-generator/actions.js";
import { DealRelevantEvent } from "../deal-generator/events.js";
import { DealStage } from '../hubspot/interfaces.js';
import { License } from "../model/license.js";
import { Transaction } from "../model/transaction.js";
import { formatMoney } from "../util/formatters.js";
import { Table } from "./table.js";

export class DealDataLogger {

  constructor(private log: LogWriteStream) { }

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
          let details = `  Nothing: [${action.reason}]`;
          if (action.deal) {
            const dealId = action.deal.id;
            const { amount, dealStage } = action.deal.data;
            const recordId = [...action.deal.getMpacIds()].join(',');
            const stage = DealStage[dealStage];
            details += ` deal=${dealId}, record=${recordId}, stage=${stage}, amount=${amount}`;
          }
          this.log.writeLine(details);
          break;
        }
      }
    }
  }

  private printDealProperties(data: Record<string, any>) {
    for (const [k, v] of Object.entries(data)) {
      this.log.writeLine(`    ${k}: ${v}`);
    }
  }

  logRecords(records: (License | Transaction)[]) {
    this.log.writeLine('\n');

    const ifTx = (fn: (r: Transaction) => string) =>
      (r: License | Transaction) =>
        r instanceof Transaction ? fn(r) : '';

    Table.print({
      log: str => this.log.writeLine(str),
      title: 'Records',
      rows: records,
      cols: [
        [{ title: 'Hosting' }, record => record.data.hosting],
        [{ title: 'Record Id' }, record => record.id],
        [{ title: 'Date' }, record => record.data.maintenanceStartDate],
        [{ title: 'License Type' }, record => record.data.licenseType],
        [{ title: 'Sale Type' }, ifTx(record => record.data.saleType)],
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
          meta: e.meta,
        };
        case 'purchase': return {
          type: e.type,
          lics: e.licenses.map(l => l.id),
          txs: [e.transaction?.id],
          meta: e.meta,
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
          meta: e.meta,
        };
        case 'upgrade': return {
          type: e.type,
          lics: [],
          txs: [e.transaction.id],
          meta: e.meta,
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
        [{ title: 'Metadata' }, row => row.meta ?? ''],
      ],
    });
  }

  close() {
    this.log.close();
  }

}
