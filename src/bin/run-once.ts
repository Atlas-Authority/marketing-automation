import 'source-map-support/register';
import DataDir from '../lib/data/dir';
import { DataSet } from '../lib/data/set';
import { Engine } from "../lib/engine/engine";
import { HubspotService } from '../lib/hubspot/service';
import log from '../lib/log/logger';
import { getCliArgs } from '../lib/parameters/cli-args';
import { engineConfigFromENV } from '../lib/parameters/env-config';

const { loglevel, savelogs } = getCliArgs('loglevel', 'savelogs');

log.setLevelFrom(loglevel);

const dataDir = DataDir.root.subdir('in');
const logDir = savelogs ? dataDir.subdir(savelogs) : null;

const engine = new Engine(HubspotService.memoryFromENV(), engineConfigFromENV());

const data = new DataSet(dataDir).load();

engine.run(data, logDir);
