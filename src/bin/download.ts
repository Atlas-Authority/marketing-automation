import 'source-map-support/register';
import { dataManager } from '../lib/data/manager';
import { downloadAllData } from '../lib/engine/download';
import { Hubspot } from '../lib/hubspot';
import { Console } from '../lib/log/console';

const dataSet = dataManager.newDataSet();
const console = new Console();
const hubspot = Hubspot.live(console);
downloadAllData(console, dataSet, hubspot);
