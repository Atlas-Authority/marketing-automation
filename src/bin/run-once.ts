import 'source-map-support/register';
import { engineConfigFromENV } from '../lib/config/env';
import { dataManager } from '../lib/data/manager';
import { DataSet } from '../lib/data/set';
import { Engine } from "../lib/engine";
import { Hubspot } from '../lib/hubspot';
import { Logger } from '../lib/log';

const dataDir = dataManager.latestDataDir();
const log = new Logger(dataDir.subdir(`once-${Date.now()}`));

const hubspot = Hubspot.memoryFromENV(log.consoleLogger);

const engine = new Engine(hubspot, engineConfigFromENV(), log);

const data = new DataSet(dataDir).load();

engine.run(data);

hubspot.populateFakeIds();
log.hubspotOutputLogger()?.logResults(hubspot);
