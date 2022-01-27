import 'source-map-support/register';
import { engineConfigFromENV } from '../lib/config/env';
import { dataManager } from '../lib/data/manager';
import { DataSet } from '../lib/data/set';
import { Engine } from "../lib/engine";
import { Hubspot } from '../lib/hubspot';
import { LogDir } from '../lib/log';
import { isPresent, sorter } from "../lib/util/helpers";

const engine = new Engine(Hubspot.memory(), engineConfigFromENV());
const dataDir = dataManager.latestDataDir();
const logDir = new LogDir(dataDir.subdir(`inspect-${Date.now()}`));
const data = new DataSet(dataDir).load();
engine.run(data);

const attributions = (engine
  .licenses
  .map(l => l.data.attribution)
  .filter(isPresent)
  .sort(sorter(a => [
    Object.keys(a).length,
    a.channel,
    a.referrerDomain,
  ].join(',')))
);

logDir.attributionsLog()!.writeArray(attributions.map(a => ({
  channel: a.channel,
  referrerDomain: a.referrerDomain,
  campaignName: a.campaignName,
  campaignSource: a.campaignSource,
  campaignMedium: a.campaignMedium,
  campaignContent: a.campaignContent,
})));
