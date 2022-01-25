import 'source-map-support/register';
import DataDir from '../lib/data/dir';
import { DataSet } from '../lib/data/set';
import { Engine } from "../lib/engine/engine";
import { Hubspot } from '../lib/hubspot';
import { logHubspotResults } from '../lib/hubspot/log-results';
import log from '../lib/log/logger';
import { getCliArgs } from '../lib/parameters/cli-args';
import { engineConfigFromENV } from '../lib/parameters/env-config';

const { loglevel, savelogs } = getCliArgs('loglevel', 'savelogs');

log.setLevelFrom(loglevel);

const dataDir = DataDir.root.subdir('in');
const logDir = savelogs ? dataDir.subdir(savelogs) : null;

const hubspot = Hubspot.memoryFromENV();

const engine = new Engine(hubspot, engineConfigFromENV());

const data = new DataSet(dataDir).load();

engine.run(data, logDir);

if (logDir) logHubspotResults(hubspot, logDir.file('hubspot-out.txt'));
