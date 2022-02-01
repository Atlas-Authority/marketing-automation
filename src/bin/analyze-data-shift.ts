import 'source-map-support/register';
import { dataManager } from '../lib/data/manager';
import { ConsoleLogger } from '../lib/log/console';

const console = new ConsoleLogger();

console.printInfo('Analyze Data Shift', `Starting...`);

const dataSets = dataManager.allDataSets();

// const datas = dataSets.map(ds => ds.dataSet.load());
