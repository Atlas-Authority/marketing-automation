import 'source-map-support/register';
import { dataManager } from '../lib/data/manager';
import { DataSet } from '../lib/data/set';
import { downloadAllData } from '../lib/engine/download';
import { Hubspot } from '../lib/hubspot';
import { ConsoleLogger } from '../lib/log/console';

const dataDir = dataManager.newDataDir();
const log = new ConsoleLogger();
const dataSet = new DataSet(dataDir);
const hubspot = Hubspot.live(log);
downloadAllData(log, dataSet, hubspot);
