import { DataSet } from "../data/set";
import { ConsoleLogger } from "../log/console";
import { License } from "../model/license";

export class DataShiftAnalyzer {

  private console;
  public constructor() {
    this.console = new ConsoleLogger();
  }

  public run([firstDataset, ...dataSets]: DataSet[]) {
    this.console.printInfo('Analyze Data Shift', `Preparing initial licenses`);
    const licensesById = new Map<string, License>();
    for (const license of firstDataset.mpac.licenses) {
      licensesById.set(license.id, license);
    }
    this.console.printInfo('Analyze Data Shift', `Done.`);

    this.console.printInfo('Analyze Data Shift', `Analyzing license data shift`);
    for (const ds of dataSets) {

      for (const license of ds.mpac.licenses) {
        const found = licensesById.get(license.id);
        if (!found) {
          this.console.printWarning('Analyze Data Shift', 'License went missing:', {
            timestampChecked: ds.timestamp,
            license: license.id,
          });
        }
      }

      for (const license of ds.mpac.licenses) {
        const found = licensesById.get(license.id);
        if (!found) {
          this.console.printWarning('Analyze Data Shift', 'License went missing:', {
            timestampChecked: ds.timestamp,
            license: license.id,
          });
        }
      }

    }
    this.console.printInfo('Analyze Data Shift', `Done.`);
  }

}
