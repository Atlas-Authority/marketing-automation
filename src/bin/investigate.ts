import 'source-map-support/register';
import { engineConfigFromENV } from '../lib/config/env';
import DataDir from '../lib/data/dir';
import { DataSet } from '../lib/data/set';
import { Engine } from "../lib/engine/engine";
import { printSummary } from "../lib/engine/summary";
import { Hubspot } from '../lib/hubspot';

const engine = new Engine(Hubspot.memory(), engineConfigFromENV());
const data = new DataSet(DataDir.root.subdir('in')).load();
engine.run(data);
printSummary(engine);
