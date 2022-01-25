import 'source-map-support/register';
import DataDir from '../lib/data/dir';
import { DataSet } from '../lib/data/set';
import { Engine } from "../lib/engine/engine";
import { Hubspot } from '../lib/hubspot';
import { engineConfigFromENV } from '../lib/parameters/env-config';
import { isPresent, sorter } from "../lib/util/helpers";

const engine = new Engine(Hubspot.memory(), engineConfigFromENV());
const dataDir = DataDir.root.subdir('in');
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

dataDir.subdir('inspect').file('attributions.csv').writeArray(attributions.map(a => ({
  channel: a.channel,
  referrerDomain: a.referrerDomain,
  campaignName: a.campaignName,
  campaignSource: a.campaignSource,
  campaignMedium: a.campaignMedium,
  campaignContent: a.campaignContent,
})));
