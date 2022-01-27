import 'source-map-support/register';
import { engineConfigFromENV } from '../lib/config/env';
import { dataManager } from '../lib/data/manager';
import { DataSet } from '../lib/data/set';
import { Engine } from "../lib/engine";
import { printSummary } from "../lib/engine/summary";
import { Hubspot } from '../lib/hubspot';

const engine = new Engine(Hubspot.memory(), engineConfigFromENV());
const data = new DataSet(dataManager.latestDataDir()).load();
engine.run(data);
printSummary(engine);
