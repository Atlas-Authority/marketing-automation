import 'source-map-support/register';
import { engineConfigFromENV } from '../lib/config/env';
import { dataManager } from '../lib/data/manager';
import { DataSet } from '../lib/data/set';
import { Engine } from "../lib/engine";
import { Hubspot } from '../lib/hubspot';
import { Console } from '../lib/log/console';

const dataDir = dataManager.latestDataDir();
const dataSet = new DataSet(dataDir);
const logDir = dataSet.logDirNamed(`once-${Date.now()}`);

const console = new Console();

const hubspot = Hubspot.memoryFromENV(console);

const engine = new Engine(hubspot, engineConfigFromENV(), console, logDir);

const data = dataSet.load();

engine.run(data);

hubspot.populateFakeIds();
logDir.hubspotOutputLogger()?.logResults(hubspot);
