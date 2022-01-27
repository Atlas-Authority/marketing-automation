import 'source-map-support/register';
import { engineConfigFromENV } from '../lib/config/env';
import { dataManager } from '../lib/data/manager';
import { DataSet } from '../lib/data/set';
import { Engine } from "../lib/engine";
import { Hubspot } from '../lib/hubspot';
import { LogDir } from '../lib/log';
import { Console } from '../lib/log/console';

const dataDir = dataManager.latestDataDir();
const logDir = new LogDir(dataDir.subdir(`once-${Date.now()}`));

const console = new Console();

const hubspot = Hubspot.memoryFromENV(console);

const engine = new Engine(hubspot, engineConfigFromENV(), console, logDir);

const data = new DataSet(dataDir).load();

engine.run(data);

hubspot.populateFakeIds();
logDir.hubspotOutputLogger()?.logResults(hubspot);
