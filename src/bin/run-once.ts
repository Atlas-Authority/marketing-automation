import 'source-map-support/register';
import DataDir from '../lib/data/dir';
import { DataSet } from '../lib/data/set';
import { Engine } from "../lib/engine/engine";
import { Hubspot } from '../lib/hubspot';
import { Logger } from '../lib/log';
import { engineConfigFromENV } from '../lib/parameters/env-config';

const dataDir = DataDir.root.subdir('in');
const log = new Logger(dataDir.subdir(`once-${Date.now()}`));

const hubspot = Hubspot.memoryFromENV(log);

const engine = new Engine(log, hubspot, engineConfigFromENV());

const data = new DataSet(dataDir).load();

engine.run(data);

log.hubspotOutputLogger().logResults(hubspot);
