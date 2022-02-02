import 'source-map-support/register';
import { dataManager } from '../lib/data/manager';
import { ConsoleLogger } from '../lib/log/console';
import { License } from '../lib/model/license';

const console = new ConsoleLogger();

console.printInfo('Analyze Data Shift', `Starting...`);
const [firstDataset, ...dataSets] = dataManager.allDataSets();
console.printInfo('Analyze Data Shift', `Loaded.`);

console.printInfo('Analyze Data Shift', `Preparing initial licenses`);
const licensesById = new Map<string, License>();
for (const license of firstDataset.mpac.licenses) {
  licensesById.set(license.id, license);
}
console.printInfo('Analyze Data Shift', `Done.`);

console.printInfo('Analyze Data Shift', `Analyzing license data shift`);
for (const ds of dataSets) {

  for (const license of ds.mpac.licenses) {
    const found = licensesById.get(license.id);
    if (!found) {
      console.printWarning('Analyze Data Shift', 'License went missing:', {
        timestampChecked: ds.timestamp,
        license: license.id,
      });
    }
  }

}
console.printInfo('Analyze Data Shift', `Done.`);
