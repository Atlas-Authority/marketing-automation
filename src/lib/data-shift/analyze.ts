import { DataSet } from "../data/set";
import { ConsoleLogger } from "../log/console";
import { License } from "../model/license";

export class DataShiftAnalyzer {

  #console = new LabeledConsoleLogger('Analyze Data Shift');

  public run(dataSets: DataSet[]) {
    this.checkForDeletedLicenses(dataSets);
    this.checkForLicensesAddedLater(dataSets);
  }

  private checkForDeletedLicenses([firstDataset, ...remainingDataSets]: DataSet[]) {
    this.#console.printInfo(`Checking for deleted licenses: Starting...`);

    let lastLicenseMap = new LicenseMap(firstDataset.mpac.licenses);

    for (const ds of remainingDataSets) {
      const currentLicenseMap = new LicenseMap(ds.mpac.licenses);

      for (const license of lastLicenseMap.allLicenses()) {
        const found = currentLicenseMap.get(license);
        if (!found) {
          this.#console.printWarning('License went missing:', {
            timestampChecked: ds.timestamp.toISO(),
            license: license.id,
          });
        }
      }

      lastLicenseMap = currentLicenseMap;
    }

    this.#console.printInfo(`Checking for deleted licenses: Done`);
  }

  private checkForLicensesAddedLater([firstDataset, ...remainingDataSets]: DataSet[]) {
    this.#console.printInfo(`Checking for licenses added later: Starting...`);



    this.#console.printInfo(`Checking for licenses added later: Done`);
  }

}

class LabeledConsoleLogger {

  #console = new ConsoleLogger();
  constructor(private label: string) { }

  printInfo(...args: any[]) { this.#console.printInfo(this.label, ...args); }
  printWarning(...args: any[]) { this.#console.printWarning(this.label, ...args); }
  printError(...args: any[]) { this.#console.printError(this.label, ...args); }

}

class LicenseMap {

  #map;
  constructor(licenses: License[]) {
    this.#map = new Map<string, License>();
    for (const license of licenses) {
      this.add(license);
    }
  }

  get(record: License): License | undefined {
    return (
      this.maybeGet(record.data.addonLicenseId) ??
      this.maybeGet(record.data.appEntitlementId) ??
      this.maybeGet(record.data.appEntitlementNumber)
    );
  }

  allLicenses() {
    return new Set(this.#map.values());
  }

  maybeGet(id: string | null): License | undefined {
    if (id) return this.#map.get(id);
    return undefined;
  }

  add(record: License) {
    if (record.data.addonLicenseId) this.#map.set(record.data.addonLicenseId, record);
    if (record.data.appEntitlementId) this.#map.set(record.data.appEntitlementId, record);
    if (record.data.appEntitlementNumber) this.#map.set(record.data.appEntitlementNumber, record);
  }

}
