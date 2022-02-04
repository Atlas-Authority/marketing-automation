import { DataSet } from "../data/set";
import { ConsoleLogger } from "../log/console";
import { License } from "../model/license";
import { Transaction } from "../model/transaction";

export class DataShiftAnalyzer {

  licensesById = new MpacMap<License>();

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
        const found = this.licensesById.get(license);
        if (!found) {
          this.console.printWarning('License went missing:', {
            timestampChecked: ds.timestamp.toISO(),
            license: license.id,
          });
        }
      }

      for (const license of ds.mpac.licenses) {
        const found = this.licensesById.get(license);
        if (!found) {
          this.console.printWarning('License went missing:', {
            timestampChecked: ds.timestamp.toISO(),
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
      this.licensesById.addKeys(license);
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

class MpacMap<T extends License | Transaction>  {

  #m;
  constructor() {
    this.#m = new Map<string, T>();
  }

  get(record: T): T | undefined {
    return (
      this.maybeGet(record.data.addonLicenseId) ??
      this.maybeGet(record.data.appEntitlementId) ??
      this.maybeGet(record.data.appEntitlementNumber)
    );
  }

  maybeGet(id: string | null): T | undefined {
    if (id) return this.#m.get(id);
    return undefined;
  }

  addKeys(record: T) {
    if (record.data.addonLicenseId) this.#m.set(record.data.addonLicenseId, record);
    if (record.data.appEntitlementId) this.#m.set(record.data.appEntitlementId, record);
    if (record.data.appEntitlementNumber) this.#m.set(record.data.appEntitlementNumber, record);
  }

}

const m = new MpacMap<Transaction>();
