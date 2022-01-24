import 'source-map-support/register';
import DataDir from '../lib/data/dir';
import { DataSet } from '../lib/data/set';
import { downloadAllData } from '../lib/engine/download';
import { Hubspot } from '../lib/hubspot';

const dataDir = DataDir.root.subdir("in");
const dataSet = new DataSet(dataDir);
const hubspot = Hubspot.live();
downloadAllData(dataSet, hubspot);
