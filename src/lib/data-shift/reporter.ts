import { ConsoleLogger } from "../log/console";
import { Table } from "../log/table";
import { sorter } from "../util/helpers";
import { AlteredRecordIssue, DeletedRecordIssue, LateTransactionIssue } from "./analyze";

export class DataShiftReporter {

  public constructor(
    private console: ConsoleLogger,
  ) { }

  public report(results: {
    deletedLicenses: DeletedRecordIssue[];
    deletedTransactions: DeletedRecordIssue[];
    lateTransactions: LateTransactionIssue[];
    alteredTransactions: AlteredRecordIssue[];
    alteredLicenses: AlteredRecordIssue[];
  }) {

    this.#reportResult('Altered Licenses', results.alteredLicenses, [
      [{ title: 'ID' }, row => row.id],
      [{ title: 'Field' }, row => row.key],
      [{ title: 'Value' }, row => row.val],
      [{ title: 'Last Value' }, row => row.lastVal],
    ]);

    this.#reportResult('Altered Transactions', results.alteredTransactions, [
      [{ title: 'ID' }, row => row.id],
      [{ title: 'Field' }, row => row.key],
      [{ title: 'Value' }, row => row.val],
      [{ title: 'Last Value' }, row => row.lastVal],
    ]);

    this.#reportResult('Deleted Licenses', results.deletedLicenses, [
      [{ title: 'ID' }, row => row.id],
      [{ title: 'Timestamp' }, row => row.timestampChecked],
    ]);

    this.#reportResult('Deleted Transactions', results.deletedTransactions, [
      [{ title: 'ID' }, row => row.id],
      [{ title: 'Timestamp' }, row => row.timestampChecked],
    ]);

    this.#reportResult('Late Transactions', results.lateTransactions, [
      [{ title: 'ID' }, row => row.id],
      [{ title: 'Date Expected' }, row => row.expected],
      [{ title: 'Date Found' }, row => row.found],
    ]);

  }

  #reportResult<T>(resultKind: string, resultItems: T[], colSpecs: [{ title: string }, (t: T) => string][]) {
    if (resultItems.length === 0) {
      this.console.printInfo('Data Shift Analyzer', `No ${resultKind} found`);
    }
    else {
      resultItems.sort(sorter(JSON.stringify));
      Table.print({
        title: resultKind,
        log: str => this.console.printWarning('Data Shift Analyzer', str),
        cols: colSpecs,
        rows: resultItems,
      });
    }
  }

}
