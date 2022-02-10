import { SlackNotifier } from "../engine/slack-notifier";
import { ConsoleLogger } from "../log/console";
import { Table } from "../log/table";
import { sorter } from "../util/helpers";
import { AlteredRecordIssue, DeletedRecordIssue, LateTransactionIssue } from "./analyze";

export class DataShiftReporter {

  public constructor(
    private console: ConsoleLogger,
    private slack?: SlackNotifier,
  ) { }

  public report(results: {
    deletedLicenses: DeletedRecordIssue[];
    deletedTransactions: DeletedRecordIssue[];
    lateTransactions: LateTransactionIssue[];
    alteredTransactions: AlteredRecordIssue[];
    alteredLicenses: AlteredRecordIssue[];
  }) {

    this.#reportResult('Altered Licenses', results.alteredLicenses, [
      [{ title: 'License' }, row => row.id],
      [{ title: 'Field' }, row => row.key],
      [{ title: 'Value' }, row => row.val],
      [{ title: 'Last Value' }, row => row.lastVal],
    ]);

    this.#reportResult('Altered Transactions', results.alteredTransactions, [
      [{ title: 'Transaction' }, row => row.id],
      [{ title: 'Field' }, row => row.key],
      [{ title: 'Value' }, row => row.val],
      [{ title: 'Last Value' }, row => row.lastVal],
    ]);

    this.#reportResult('Deleted Licenses', results.deletedLicenses, [
      [{ title: 'License' }, row => row.id],
      [{ title: 'Timestamp' }, row => row.timestampChecked],
    ]);

    this.#reportResult('Deleted Transactions', results.deletedTransactions, [
      [{ title: 'Transaction' }, row => row.id],
      [{ title: 'Timestamp' }, row => row.timestampChecked],
    ]);

    this.#reportResult('Late Transactions', results.lateTransactions, [
      [{ title: 'Transaction' }, row => row.id],
      [{ title: 'Date Expected' }, row => row.expected],
      [{ title: 'Date Found' }, row => row.found],
    ]);

  }

  #reportResult<T>(resultLabel: string, resultItems: T[], colSpecs: [{ title: string }, (t: T) => string][]) {
    if (resultItems.length === 0) {
      this.console.printInfo('Data Shift Analyzer', `No ${resultLabel} found`);
    }
    else {
      resultItems.sort(sorter(JSON.stringify));
      Table.print({
        title: resultLabel,
        log: str => this.console.printWarning('Data Shift Analyzer', str),
        cols: colSpecs,
        rows: resultItems,
      });

      this.slack?.notifyDataShiftIssues(resultLabel, Table.toString({
        cols: colSpecs,
        rows: resultItems,
      }));
    }
  }

}
