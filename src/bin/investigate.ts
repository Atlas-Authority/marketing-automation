import 'source-map-support/register';
import { engineConfigFromENV } from '../lib/config/env';
import { dataManager } from '../lib/data/manager';
import { dataSetConfigFromENV } from '../lib/data/set';
import { Engine } from "../lib/engine";
import { printSummary } from "../lib/engine/summary";

const dataSet = dataManager.latestDataSet(dataSetConfigFromENV());
const engine = new Engine(dataSet, engineConfigFromENV());
engine.run();
printSummary(engine);
