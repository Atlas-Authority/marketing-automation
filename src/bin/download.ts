import 'source-map-support/register';
import { DataSet, dataSetConfigFromENV } from '../lib/data/data';
import { downloadAllData } from '../lib/engine/download';
import { ConsoleLogger } from '../lib/log/console';

const console = new ConsoleLogger();
const dataSet = new DataSet(dataSetConfigFromENV());
downloadAllData(console, dataSet.hubspot);
