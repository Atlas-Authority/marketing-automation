import 'source-map-support/register';
import { engineConfigFromENV } from '../lib/config/env';
import { dataManager } from '../lib/data/manager';
import { DataSet, dataSetConfigFromENV } from '../lib/data/set';
import { Engine } from "../lib/engine";
import { printSummary } from "../lib/engine/summary";

const engine = new Engine(new DataSet(dataSetConfigFromENV()), engineConfigFromENV());
const { data } = dataManager.latestDataSet();
engine.run(data);
printSummary(engine);
