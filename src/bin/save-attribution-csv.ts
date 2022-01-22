import 'source-map-support/register';
import DataDir from '../lib/data/dir';
import { DataSet } from '../lib/data/set';
import { Engine } from "../lib/engine/engine";
import { HubspotService } from '../lib/hubspot/service';
import log from "../lib/log/logger";
import { engineConfigFromENV } from '../lib/parameters/env-config';
import { isPresent, sorter } from "../lib/util/helpers";

main();
async function main() {

  log.level = log.Levels.Verbose;
  const engine = new Engine(HubspotService.memory(), engineConfigFromENV());
  const data = new DataSet(DataDir.root.subdir('in')).load();
  engine.importData(data);

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

  DataDir.root.subdir('inspect').file('attributions.csv').writeArray(attributions.map(a => ({
    channel: a.channel,
    referrerDomain: a.referrerDomain,
    campaignName: a.campaignName,
    campaignSource: a.campaignSource,
    campaignMedium: a.campaignMedium,
    campaignContent: a.campaignContent,
  })));

}
