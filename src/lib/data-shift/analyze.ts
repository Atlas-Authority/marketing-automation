import { DateTime } from "luxon";
import { DataSet } from "../data/set";
import { ConsoleLogger } from "../log/console";
import { Marketplace } from "../marketplace/marketplace";
import { License } from "../model/license";
import { Transaction } from "../model/transaction";
import { MultiRecordMap } from "./multi-id-map";

export interface DataShiftConfig {
  lateTransactionThresholdDays: number,
}

const defaultConfig: DataShiftConfig = {
  lateTransactionThresholdDays: 30,
};

export interface DeletedRecordIssue {
  id: string,
  timestampNotFound: string,
  timestampLastSeen: string,
}

export interface LateTransactionIssue {
  id: string,
  expected: string,
  found: string,
}

export interface AlteredRecordIssue {
  id: string,
  key: string,
  val: any,
  lastVal: any,
}

export class DataShiftAnalyzer {

  #logStep = (...args: any[]) => this.console?.printInfo('Analyze Data Shift', ...args);

  #config;
  constructor(
    config?: DataShiftConfig,
    private console?: ConsoleLogger,
  ) {
    this.#config = config ?? defaultConfig;
  }

  public run(dataSetsAsc: DataSet[]) {
    return {

      deletedLicenses:
        this.#checkForDeletedRecords(dataSetsAsc, 'license',
          mpac => mpac.licenses),

      deletedTransactions:
        this.#checkForDeletedRecords(dataSetsAsc, 'transaction',
          mpac => mpac.transactions),

      lateTransactions:
        this.#checkForWrongTransactionDates(dataSetsAsc),

      alteredTransactions:
        this.#checkForAlteredRecordData(dataSetsAsc, 'transaction',
          mpac => mpac.transactions, [
          d => d.saleDate,
          d => d.saleType,

          d => d.addonKey,
          d => d.addonName,
          d => d.hosting,

          d => d.country,
          d => d.region,

          d => d.purchasePrice.toString(),
          d => d.vendorAmount.toString(),

          d => d.billingPeriod,

          d => d.maintenanceStartDate,
          d => d.maintenanceEndDate,
        ]),

      alteredLicenses:
        this.#checkForAlteredRecordData(dataSetsAsc, 'license',
          mpac => mpac.licenses, [
          d => d.addonKey,
          d => d.addonName,
          d => d.hosting,

          d => d.maintenanceStartDate,
        ]),

    };
  }

  #checkForDeletedRecords<T extends License | Transaction>(dataSetsAsc: DataSet[], kind: 'license' | 'transaction', getRecords: (mpac: Marketplace) => T[]) {
    const deletedRecords: DeletedRecordIssue[] = [];

    this.#logStep(`Checking for deleted ${kind}s: Starting...`);

    const [firstDataset, ...remainingDataSets] = dataSetsAsc;

    let lastRecordMap = new MultiRecordMap<License | Transaction, DateTime>();
    for (const record of getRecords(firstDataset.mpac)) {
      lastRecordMap.set(record, firstDataset.timestamp);
    }

    for (const ds of remainingDataSets) {
      const currentRecordMap = new MultiRecordMap<License | Transaction, DateTime>();
      for (const record of getRecords(ds.mpac)) {
        currentRecordMap.set(record, ds.timestamp);
      }

      for (const [record, dateLastSeen] of lastRecordMap.entries()) {
        const found = currentRecordMap.get(record);
        if (!found) {
          deletedRecords.push({
            id: record.id,
            timestampNotFound: ds.timestamp.toISO(),
            timestampLastSeen: dateLastSeen.toISO(),
          });
        }
      }

      lastRecordMap = currentRecordMap;
    }

    this.#logStep(`Checking for deleted ${kind}s: Done`);

    return deletedRecords;
  }

  #checkForWrongTransactionDates(dataSetsAsc: DataSet[]) {
    const lateTransactions: LateTransactionIssue[] = [];

    this.#logStep(`Checking for late transactions: Starting...`);

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

      if (diff.days > this.#config.lateTransactionThresholdDays) {
        lateTransactions.push({
          id: transaction.id,
          expected: transaction.data.saleDate,
          found: foundDate.toISODate(),
        });
      }
    }

    this.#logStep(`Checking for late transactions: Done`);

    return lateTransactions;
  }

  #checkForAlteredRecordData<T extends License | Transaction, D = T['data']>(
    dataSetsAsc: DataSet[],
    recordKind: 'license' | 'transaction',
    getRecords: (mpac: Marketplace) => T[],
    fieldsToExamine: ((data: D) => string)[],
  ) {
    const alteredRecords: AlteredRecordIssue[] = [];

    this.#logStep(`Checking for altered ${recordKind} data: Starting...`);

    const map = new MultiRecordMap<T, D>();

    for (const dataSet of dataSetsAsc) {
      for (const record of getRecords(dataSet.mpac)) {
        const data = record.data as unknown as D;
        const lastData = map.get(record);
        if (lastData) {
          for (const key of fieldsToExamine) {
            const val = key(data);
            const lastVal = key(lastData);
            if (val !== lastVal) {
              alteredRecords.push({
                id: record.id,
                key: key.toString().replace(/^d => d\./, ''),
                val,
                lastVal,
              });
            }
          }
        }
        map.set(record, data);
      }
    }

    this.#logStep(`Checking for altered ${recordKind} data: Done`);

    return alteredRecords;
  }

}
