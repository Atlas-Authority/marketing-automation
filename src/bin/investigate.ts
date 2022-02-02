import 'source-map-support/register';
import { engineConfigFromENV } from '../lib/config/env';
import { dataManager } from '../lib/data/manager';
import { Engine } from "../lib/engine/engine";
import { printSummary } from "../lib/engine/summary";

const dataSet = dataManager.latestDataSet();
const engine = new Engine(engineConfigFromENV());
engine.run(dataSet);
printSummary(engine);
