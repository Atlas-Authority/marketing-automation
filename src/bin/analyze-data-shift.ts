import 'source-map-support/register';
import { DataShiftAnalyzer } from '../lib/data-shift/analyze';
import { dataManager } from '../lib/data/manager';
import { ConsoleLogger } from '../lib/log/console';
import { Table } from '../lib/log/table';
import { sorter } from '../lib/util/helpers';

const console = new ConsoleLogger();
console.printInfo('Data Shift Analyzer', 'Loading data sets: Starting...');
const dataSets = dataManager.allDataSetIds().sort().map(id => {
  console.printInfo('Data Shift Analyzer', `Loading data set ${id}: Starting...`);
  const ds = dataManager.dataSetFrom(id);
  console.printInfo('Data Shift Analyzer', `Loading data set ${id}: Done`);
  return ds;
});
console.printInfo('Data Shift Analyzer', 'Loading data sets: Done');

const analyzer = new DataShiftAnalyzer(console);
const results = analyzer.run(dataSets);

reportResult('Altered Licenses', results.alteredLicenses, [
  [{ title: 'ID' }, row => row.id],
  [{ title: 'Field' }, row => row.key],
  [{ title: 'Value' }, row => row.val],
  [{ title: 'Last Value' }, row => row.lastVal],
]);

reportResult('Altered Transactions', results.alteredTransactions, [
  [{ title: 'ID' }, row => row.id],
  [{ title: 'Field' }, row => row.key],
  [{ title: 'Value' }, row => row.val],
  [{ title: 'Last Value' }, row => row.lastVal],
]);

reportResult('Deleted Licenses', results.deletedLicenses, [
  [{ title: 'ID' }, row => row.id],
  [{ title: 'Timestamp' }, row => row.timestampChecked],
]);

reportResult('Deleted Transactions', results.deletedTransactions, [
  [{ title: 'ID' }, row => row.id],
  [{ title: 'Timestamp' }, row => row.timestampChecked],
]);

reportResult('Late Transactions', results.lateTransactions, [
  [{ title: 'ID' }, row => row.id],
  [{ title: 'Date Expected' }, row => row.expected],
  [{ title: 'Date Found' }, row => row.found],
]);

function reportResult<T>(resultKind: string, resultItems: T[], colSpecs: [{ title: string }, (t: T) => string][]) {
  if (resultItems.length === 0) {
    console.printInfo('Data Shift Analyzer', `No ${resultKind} found`);
  }
  else {
    resultItems.sort(sorter(JSON.stringify));
    Table.print({
      title: resultKind,
      log: str => console.printWarning('Data Shift Analyzer', str),
      cols: colSpecs,
      rows: resultItems,
    });
  }
}
