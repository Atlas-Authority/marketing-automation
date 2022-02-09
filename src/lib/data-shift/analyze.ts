import { DateTime } from "luxon";
import { DataSet } from "../data/set";
import { ConsoleLogger } from "../log/console";
import { License, LicenseData } from "../model/license";
import { Transaction, TransactionData } from "../model/transaction";
import { MultiRecordMap } from "./multi-id-map";

const LATE_TRANSACTION_THRESHOLD = 30;

export class DataShiftAnalyzer {

  #console = new LabeledConsoleLogger('Analyze Data Shift');

  public run(dataSetsAsc: DataSet[]) {
    this.#checkForDeletedLicenses(dataSetsAsc);
    this.#checkForWrongTransactionDates(dataSetsAsc);
    this.#checkForAlteredTransactionData(dataSetsAsc);
    this.#checkForAlteredLicenseData(dataSetsAsc);
  }

  #checkForDeletedLicenses(dataSetsAsc: DataSet[]) {
    this.#console.printInfo(`Checking for deleted licenses: Starting...`);

    const [firstDataset, ...remainingDataSets] = dataSetsAsc;

    let lastLicenseMap = new MultiRecordMap<License, true>();
    for (const license of firstDataset.mpac.licenses) {
      lastLicenseMap.set(license, true);
    }

    for (const ds of remainingDataSets) {
      const currentLicenseMap = new MultiRecordMap<License, true>();
      for (const license of ds.mpac.licenses) {
        currentLicenseMap.set(license, true);
      }

      for (const [license,] of lastLicenseMap.entries()) {
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

  #checkForWrongTransactionDates(dataSetsAsc: DataSet[]) {
    this.#console.printInfo(`Checking for late transactions: Starting...`);

    const dataSetsDesc = [...dataSetsAsc].reverse();
    const transactionMap = new MultiRecordMap<Transaction, DateTime>();

    for (const ds of dataSetsDesc) {
      for (const transaction of ds.mpac.transactions) {
        transactionMap.set(transaction, ds.timestamp);
      }
    }

    const earliest = dataSetsDesc[dataSetsDesc.length - 1].timestamp;

    for (const [transaction, foundDate] of transactionMap.entries()) {
      const claimedDate = DateTime.fromISO(transaction.data.saleDate);
      const diff = foundDate.diff(claimedDate, 'days');

      if (foundDate.toMillis() === earliest.toMillis()) {
        continue;
      }

      if (diff.days > LATE_TRANSACTION_THRESHOLD) {
        this.#console.printError('Transaction is far off', {
          id: transaction.id,
          expected: transaction.data.saleDate,
          found: foundDate.toISO(),
        });
      }
    }

    this.#console.printInfo(`Checking for late transactions: Done`);
  }

  #checkForAlteredTransactionData(dataSetsAsc: DataSet[]) {
    this.#console.printInfo(`Checking for altered transaction data: Starting...`);

    const map = new MultiRecordMap<Transaction, TransactionData>();

    for (const dataSet of dataSetsAsc) {
      for (const transaction of dataSet.mpac.transactions) {
        const data = transaction.data;
        const lastData = map.get(transaction);
        if (lastData) {
          const keysToExamine: (keyof TransactionData)[] = [
            'saleDate', 'saleType',
            'addonKey', 'addonName', 'hosting',
            'country', 'region',
            'purchasePrice', 'vendorAmount',
            'billingPeriod',
            'maintenanceStartDate', 'maintenanceEndDate',
          ];
          for (const key of keysToExamine) {
            const val = data[key];
            const lastVal = lastData[key];
            if (val !== lastVal) {
              this.#console.printError(`Altered transaction data`, {
                id: transaction.id,
                key,
                val,
                lastVal,
              });
            }
          }

        }
        map.set(transaction, data);
      }
    }

    this.#console.printInfo(`Checking for altered transaction data: Done`);
  }

  #checkForAlteredLicenseData(dataSetsAsc: DataSet[]) {
    this.#console.printInfo(`Checking for altered license data: Starting...`);

    const map = new MultiRecordMap<License, LicenseData>();

    for (const dataSet of dataSetsAsc) {
      for (const license of dataSet.mpac.licenses) {
        const data = license.data;
        const lastData = map.get(license);
        if (lastData) {
          const keysToExamine: (keyof LicenseData)[] = [
            'addonKey', 'addonName', 'hosting',
            'maintenanceStartDate',
          ];
          for (const key of keysToExamine) {
            const val = data[key];
            const lastVal = lastData[key];
            if (val !== lastVal) {
              this.#console.printError(`Altered license data`, {
                id: license.id,
                key,
                val,
                lastVal,
              });
            }
          }

        }
        map.set(license, data);
      }
    }

    this.#console.printInfo(`Checking for altered license data: Done`);
  }

}

class LabeledConsoleLogger {

  #console = new ConsoleLogger();
  constructor(private label: string) { }

  printInfo(...args: any[]) { this.#console.printInfo(this.label, ...args); }
  printWarning(...args: any[]) { this.#console.printWarning(this.label, ...args); }
  printError(...args: any[]) { this.#console.printError(this.label, ...args); }

}
