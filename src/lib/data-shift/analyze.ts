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
    let lastLicenseMap = new RecordMap(firstDataset.mpac.licenses);

    for (const ds of remainingDataSets) {
      const currentLicenseMap = new RecordMap(ds.mpac.licenses);

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
    const transactionMap = new RecordMap<Transaction>([]);

    for (const ds of dataSetsDesc) {
      for (const transaction of ds.mpac.transactions) {

        const found = transactionMap.get(transaction);
        if (!found) transactionMap.add(transaction);




        // transaction.data.saleDate;
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

class RecordMap<T extends License | Transaction> {

  #map;
  constructor(records: T[]) {
    this.#map = new Map<string, T>();
    for (const record of records) {
      this.add(record);
    }
  }

  get(record: T): T | undefined {
    return (record
      .ids
      .map(id => this.maybeGet(id))
      .find(record => record)
    );
  }

  allRecords() {
    return new Set(this.#map.values());
  }

  maybeGet(id: string | null): T | undefined {
    if (id) return this.#map.get(id);
    return undefined;
  }

  add(record: T) {
    for (const id of record.ids) {
      this.#map.set(id, record);
    }
  }

}
