import 'source-map-support/register';
import DataDir from '../lib/data/dir';
import { DataSet } from '../lib/data/set';
import { downloadAllData } from '../lib/engine/download';
import { Hubspot } from '../lib/hubspot';
import { Logger } from '../lib/log';

const dataDir = DataDir.root.subdir("in");
const log = new Logger();
const dataSet = new DataSet(dataDir);
const hubspot = Hubspot.live(log);
downloadAllData(log, dataSet, hubspot);
