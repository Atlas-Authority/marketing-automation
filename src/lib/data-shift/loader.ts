import { dataManager } from "../data/manager";
import { ConsoleLogger } from "../log/console";

export function loadDataSets(console: ConsoleLogger) {
  console.printInfo('Data Shift Analyzer', 'Loading data sets: Starting...');
  console.printInfo('Data Shift Analyzer', 'Node.js Memory Usage', memoryUsage());
  const dataSets = dataManager.allDataSetIds().sort().map(id => {
    console.printInfo('Data Shift Analyzer', `Loading data set ${id}: Starting...`);
    const ds = dataManager.dataSetFrom(id);
    console.printInfo('Data Shift Analyzer', `Loading data set ${id}: Done`);
    console.printInfo('Data Shift Analyzer', 'Node.js Memory Usage', memoryUsage());
    return ds;
  });
  console.printInfo('Data Shift Analyzer', 'Loading data sets: Done');
  return dataSets;
}

function memoryUsage() {
  const mem = process.memoryUsage();
  const used = mem.heapUsed;
  const total = mem.heapTotal;
  const usedStr = (used / 1024 / 1024).toFixed(2) + ' MB';
  const totalStr = (total / 1024 / 1024).toFixed(2) + ' MB';
  const percent = ((used / total) * 100).toFixed();
  return `${percent}% (${usedStr} used / ${totalStr} total)`;
}
