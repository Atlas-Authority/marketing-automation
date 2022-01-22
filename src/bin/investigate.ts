import 'source-map-support/register';
import DataDir from '../lib/data/dir';
import { DataSet } from '../lib/data/set';
import { Engine } from "../lib/engine/engine";
import { printSummary } from "../lib/engine/summary";
import { HubspotService } from '../lib/hubspot/service';
import { engineConfigFromENV } from '../lib/parameters/env-config';

const engine = new Engine(HubspotService.memory(), engineConfigFromENV());
const data = new DataSet(DataDir.root.subdir('in')).load();
engine.importData(data);
printSummary(engine);
