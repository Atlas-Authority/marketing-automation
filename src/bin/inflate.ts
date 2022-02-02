import 'source-map-support/register';
import { cliArgs } from '../lib/config/params';
import { dataManager } from '../lib/data/manager';
import { ConsoleLogger } from '../lib/log/console';

const ms = cliArgs[0];

const console = new ConsoleLogger();
console.printInfo('Analyze Data Shift', `Inflating data set [${ms}]`);

dataManager.inflateDataSetFrom(+ms);
