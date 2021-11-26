import DataDir from "../../cache/datadir.js";
import { Table } from "../../log/table.js";
import { License } from "../../model/license.js";
import { Transaction } from "../../model/transaction.js";
import { formatMoney } from "../../util/formatters.js";
import { Action } from "./actions.js";
import { abbrEventDetails, DealRelevantEvent } from "./events.js";

export class DealDataLogger {

  plainLog = DataDir.out.file('deal-generator.txt').writeStream();
  rededLog = DataDir.out.file('deal-generator-redacted.txt').writeStream();

  close() {
    this.plainLog.close();
    this.rededLog.close();
  }

  logActions(actions: Action[]) {
    this._logActions(false, actions);
    this._logActions(true, actions);
  }

  private _logActions(redacted: boolean, actions: Action[]) {
    const log = this.loggerFor(redacted);

    function abbrActionDetails(action: Action) {
      const { type } = action;
      switch (type) {
        case 'create': return { type, data: action.properties };
        case 'update': return { type, id: action.deal.id, data: action.properties };
        case 'noop': return { type, id: action.deal.id };
      }
    }

    log.writeLine('Actions');
    log.writeLine(JSON.stringify(actions.map(action => abbrActionDetails(action)), null, 2));
  }

  logRecords(records: (License | Transaction)[]) {
    this._logRecords(false, records);
    this._logRecords(true, records);
  }

  private _logRecords(redacted: boolean, records: (License | Transaction)[]) {
    const log = this.loggerFor(redacted);

    const ifTx = (fn: (r: Transaction) => string) =>
      (r: License | Transaction) =>
        r instanceof Transaction ? fn(r) : '';

    log.writeLine('\n');
    Table.print({
      log: str => log.writeLine(str),
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
    this._logEvents(false, events);
    this._logEvents(true, events);
  }

  private _logEvents(redacted: boolean, events: DealRelevantEvent[]) {
    const log = this.loggerFor(redacted);

    const rows = events.map(abbrEventDetails);

    Table.print({
      title: 'Events',
      log: str => log.writeLine(str),
      rows: rows,
      cols: [
        [{ title: 'Type' }, row => row.type],
        [{ title: 'Licenses' }, row => row.lics?.join(', ') ?? ''],
        [{ title: 'Transactions' }, row => row.txs?.join(', ') ?? ''],
      ],
    });
  }

  private loggerFor(redacted: boolean) {
    if (redacted)
      return this.rededLog;
    else
      return this.plainLog;
  }

}
