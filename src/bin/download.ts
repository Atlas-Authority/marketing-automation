import 'source-map-support/register';
import DataDir from '../lib/data/dir';
import { DataSet } from '../lib/data/set';
import { downloadAllData } from '../lib/engine/download';
import { HubspotService } from '../lib/hubspot/service';

main();
async function main() {

  const dataDir = DataDir.root.subdir("in");
  const dataSet = new DataSet(dataDir);
  const hubspot = HubspotService.live();
  await downloadAllData(dataSet, hubspot);

}
