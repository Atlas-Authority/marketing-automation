import 'source-map-support/register';
import { DataShiftAnalyzer } from '../lib/data-shift/analyze';
import { dataManager } from '../lib/data/manager';
import { ConsoleLogger } from '../lib/log/console';

const console = new ConsoleLogger();
console.printInfo('Data Shift Analyzer', 'Loading data sets: Starting...');
const dataSets = dataManager.allDataSetIds().map(id => {
  console.printInfo('Data Shift Analyzer', `Loading data set ${id}: Starting...`);
  const ds = dataManager.dataSetFrom(id);
  console.printInfo('Data Shift Analyzer', `Loading data set ${id}: Done`);
  return ds;
});
console.printInfo('Data Shift Analyzer', 'Loading data sets: Done');

const analyzer = new DataShiftAnalyzer();
analyzer.run(dataSets);
