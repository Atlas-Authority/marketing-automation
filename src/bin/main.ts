import 'source-map-support/register';
import DataDir from '../lib/data/dir';
import { DataSet } from '../lib/data/set';
import { downloadAllData } from '../lib/engine/download';
import { Engine } from "../lib/engine/engine";
import { SlackNotifier } from '../lib/engine/slack-notifier';
import HubspotAPI from '../lib/hubspot/api';
import { HubspotService } from '../lib/hubspot/service';
import log from '../lib/log/logger';
import { getCliArgs } from '../lib/parameters/cli-args';
import { engineConfigFromENV, runLoopConfigFromENV } from "../lib/parameters/env-config";
import run from "../lib/util/runner";

const { loglevel } = getCliArgs('loglevel');
log.setLevelFrom(loglevel);

const dataDir = DataDir.root.subdir("in");
const dataSet = new DataSet(dataDir);

const runLoopConfig = runLoopConfigFromENV();
const notifier = SlackNotifier.fromENV();
notifier?.notifyStarting();

run(runLoopConfig, {

  async work() {
    log.info('Main', 'Downloading data');
    const hubspot = HubspotService.live();
    await downloadAllData(dataSet, hubspot);

    log.info('Main', 'Running engine');
    const data = new DataSet(dataDir).load();
    const engine = new Engine(hubspot, engineConfigFromENV());
    engine.run(data, null);

    log.info('Main', 'Upsyncing changes to HubSpot');
    const api = new HubspotAPI();
    await hubspot.upsyncChangesLive(api);
  },

  async failed(errors) {
    notifier?.notifyErrors(runLoopConfig, errors);
  },

});
