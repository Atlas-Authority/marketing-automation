import 'source-map-support/register';
import { engineConfigFromENV } from '../lib/config/env';
import { dataManager } from '../lib/data/manager';
import { Engine } from "../lib/engine";
import { Hubspot } from '../lib/hubspot';
import { Console } from '../lib/log/console';

const console = new Console();

const dataSet = dataManager.latestDataSet();
const logDir = dataSet.logDirNamed(`once-${Date.now()}`);

const hubspot = Hubspot.memoryFromENV(console);

const engine = new Engine(hubspot, engineConfigFromENV(), console, logDir);

const data = dataSet.load();

engine.run(data);

hubspot.populateFakeIds();
logDir.hubspotOutputLogger()?.logResults(hubspot);
