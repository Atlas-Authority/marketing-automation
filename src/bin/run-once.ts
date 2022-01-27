import 'source-map-support/register';
import { engineConfigFromENV } from '../lib/config/env';
import { dataManager } from '../lib/data/manager';
import { DataSet } from '../lib/data/set';
import { Engine } from "../lib/engine";
import { Hubspot } from '../lib/hubspot';
import { Logger } from '../lib/log';
import { Console } from '../lib/log/console';

const dataDir = dataManager.latestDataDir();
const log = new Logger(dataDir.subdir(`once-${Date.now()}`));

const console = new Console();

const hubspot = Hubspot.memoryFromENV(console);

const engine = new Engine(hubspot, engineConfigFromENV(), console, log);

const data = new DataSet(dataDir).load();

engine.run(data);

hubspot.populateFakeIds();
log.hubspotOutputLogger()?.logResults(hubspot);
