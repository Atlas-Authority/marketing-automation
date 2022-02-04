import { DataSet } from "../data/set";
import { ConsoleLogger } from "../log/console";
import { License } from "../model/license";

export class DataShiftAnalyzer {

  licensesById = new Map<string, License>();

  private console;
  public constructor() {
    this.console = new LabeledConsoleLogger('Analyze Data Shift');
  }

  public run([firstDataset, ...dataSets]: DataSet[]) {
    this.prepareInitialLicenses(firstDataset);
    this.analyzeLicensesInDataSets(dataSets);
  }

  analyzeLicensesInDataSets(dataSets: DataSet[]) {
    this.console.printInfo(`Analyzing license data shift`);
    for (const ds of dataSets) {

      for (const license of ds.mpac.licenses) {
        const found = this.licensesById.get(license.id);
        if (!found) {
          this.console.printWarning('License went missing:', {
            timestampChecked: ds.timestamp,
            license: license.id,
          });
        }
      }

      for (const license of ds.mpac.licenses) {
        const found = this.licensesById.get(license.id);
        if (!found) {
          this.console.printWarning('License went missing:', {
            timestampChecked: ds.timestamp,
            license: license.id,
          });
        }
      }

    }
    this.console.printInfo(`Done.`);
  }

  prepareInitialLicenses(firstDataset: DataSet) {
    this.console.printInfo(`Preparing initial licenses`);

    for (const license of firstDataset.mpac.licenses) {
      this.licensesById.set(license.id, license);
    }

    this.console.printInfo(`Done.`);
  }

}

class LabeledConsoleLogger {

  console;
  constructor(private label: string) {
    this.console = new ConsoleLogger();
  }

  printInfo(...args: any[]) { this.console.printInfo(this.label, ...args); }
  printWarning(...args: any[]) { this.console.printWarning(this.label, ...args); }
  printError(...args: any[]) { this.console.printError(this.label, ...args); }

}
