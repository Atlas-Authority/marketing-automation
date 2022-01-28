import 'source-map-support/register';
import { engineConfigFromENV } from '../lib/config/env';
import { dataManager } from '../lib/data/manager';
import { Engine } from "../lib/engine";
import { printSummary } from "../lib/engine/summary";
import { Hubspot } from '../lib/hubspot';
import { Marketplace } from '../lib/marketplace';

const engine = new Engine(Hubspot.fromENV(), Marketplace.fromENV(), engineConfigFromENV());
const data = dataManager.latestDataSet().dataSet.load();
engine.run(data);
printSummary(engine);
