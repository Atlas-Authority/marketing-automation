import { DataSet } from "../data/set";
import { ConsoleLogger } from "../log/console";
import { License } from "../model/license";
import { Transaction } from "../model/transaction";

export class DataShiftAnalyzer {

  #console = new LabeledConsoleLogger('Analyze Data Shift');

  public run(dataSetsAsc: DataSet[]) {
    this.checkForDeletedLicenses(dataSetsAsc);
    this.checkForWrongTransactionDates(dataSetsAsc);
  }

  private checkForDeletedLicenses(dataSetsAsc: DataSet[]) {
    this.#console.printInfo(`Checking for deleted licenses: Starting...`);

    const [firstDataset, ...remainingDataSets] = dataSetsAsc;

    let lastLicenseMap = new RecordMap<License, true>();
    for (const license of firstDataset.mpac.licenses) {
      lastLicenseMap.set(license, true);
    }

    for (const ds of remainingDataSets) {
      const currentLicenseMap = new RecordMap<License, true>();
      for (const license of ds.mpac.licenses) {
        currentLicenseMap.set(license, true);
      }

      for (const license of lastLicenseMap.allRecords()) {
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

  private checkForWrongTransactionDates(dataSetsAsc: DataSet[]) {
    this.#console.printInfo(`Checking for late transactions: Starting...`);

    const dataSetsDesc = [...dataSetsAsc].reverse();
    const transactionMap = new RecordMap<Transaction, string>();

    for (const ds of dataSetsDesc) {
      for (const transaction of ds.mpac.transactions) {
        const found = transactionMap.get(transaction);
        if (!found) transactionMap.set(transaction, transaction.data.saleDate);
      }
    }

    this.#console.printInfo(`Checking for late transactions: Done`);
  }

}

class LabeledConsoleLogger {

  #console = new ConsoleLogger();
  constructor(private label: string) { }

  printInfo(...args: any[]) { this.#console.printInfo(this.label, ...args); }
  printWarning(...args: any[]) { this.#console.printWarning(this.label, ...args); }
  printError(...args: any[]) { this.#console.printError(this.label, ...args); }

}

class RecordMap<T extends License | Transaction, U> {

  #keys = new Map<string, T>();
  #map = new Map<T, U>();

  public get(record: T): U | undefined {
    const key = (record
      .ids
      .map(id => this.#maybeGet(id))
      .find(record => record)
    );
    if (key) {
      const val = this.#map.get(key);
      if (val !== undefined) {
        this.set(record, val);
      }
      return val;
    }
    return undefined;
  }

  #maybeGet(id: string | null): T | undefined {
    if (id) return this.#keys.get(id);
    return undefined;
  }

  public allRecords() {
    return new Set(this.#keys.values());
  }

  public set(key: T, val: U) {
    for (const id of key.ids) {
      this.#keys.set(id, key);
    }
    this.#map.set(key, val);
  }

}
