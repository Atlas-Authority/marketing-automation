import { dataManager } from "../data/manager";
import { ConsoleLogger } from "../log/console";

export function loadDataSets(console: ConsoleLogger) {
  console.printInfo('Data Shift Analyzer', 'Loading data sets: Starting...');
  const dataSets = dataManager.allDataSetIds().sort().map(id => {
    console.printInfo('Data Shift Analyzer', `Loading data set ${id}: Starting...`);
    const ds = dataManager.dataSetFrom(id);
    console.printInfo('Data Shift Analyzer', `Loading data set ${id}: Done`);
    return ds;
  });
  console.printInfo('Data Shift Analyzer', 'Loading data sets: Done');
  return dataSets;
}
