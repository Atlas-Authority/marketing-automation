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
analyzer.run(dataSets);

if (analyzer.alteredRecords.length === 0) {
  console.printInfo('Data Shift Analyzer', 'No altered records found');
}
else {
  analyzer.alteredRecords.sort(sorter(JSON.stringify));
  Table.print({
    title: 'Altered Records',
    log: str => console.printWarning('Data Shift Analyzer', str),
    cols: [
      [{ title: 'Kind' }, row => row.kind],
      [{ title: 'ID' }, row => row.id],
      [{ title: 'Field' }, row => row.key],
      [{ title: 'Value' }, row => row.val],
      [{ title: 'Last Value' }, row => row.lastVal],
    ],
    rows: analyzer.alteredRecords,
  });
}

if (analyzer.deletedRecords.length === 0) {
  console.printInfo('Data Shift Analyzer', 'No deleted records found');
}
else {
  analyzer.deletedRecords.sort(sorter(JSON.stringify));
  Table.print({
    title: 'Deleted Records',
    log: str => console.printWarning('Data Shift Analyzer', str),
    cols: [
      [{ title: 'Kind' }, row => row.kind],
      [{ title: 'ID' }, row => row.id],
      [{ title: 'Timestamp' }, row => row.timestampChecked],
    ],
    rows: analyzer.deletedRecords,
  });
}

if (analyzer.lateTransactions.length === 0) {
  console.printInfo('Data Shift Analyzer', 'No late transactions found');
}
else {
  analyzer.lateTransactions.sort(sorter(JSON.stringify));
  Table.print({
    title: 'Late Transactions',
    log: str => console.printWarning('Data Shift Analyzer', str),
    cols: [
      [{ title: 'ID' }, row => row.id],
      [{ title: 'Date Expected' }, row => row.expected],
      [{ title: 'Date Found' }, row => row.found],
    ],
    rows: analyzer.lateTransactions,
  });
}
