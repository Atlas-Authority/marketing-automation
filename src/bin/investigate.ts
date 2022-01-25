import 'source-map-support/register';
import DataDir from '../lib/data/dir';
import { DataSet } from '../lib/data/set';
import { Engine } from "../lib/engine/engine";
import { printSummary } from "../lib/engine/summary";
import { Hubspot } from '../lib/hubspot';
import { engineConfigFromENV } from '../lib/parameters/env-config';

const engine = new Engine(null, Hubspot.memory(null), engineConfigFromENV());
const data = new DataSet(DataDir.root.subdir('in')).load();
engine.run(data);
printSummary(null, engine);
