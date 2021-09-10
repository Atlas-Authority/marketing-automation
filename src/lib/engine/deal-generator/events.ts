import { sorter } from "../../util/helpers.js";

export type DealRelevantEvent = (
  { type: 'refund', refundedTxIds: string[] } |
  { type: 'eval', licenseIds: string[] } |
  { type: 'purchase', licenseIds: string[], transactions: Transaction[] } |
  { type: 'renewal', transaction: Transaction } |
  { type: 'upgrade', transaction: Transaction }
);

export class EventGenerator {

  events: DealRelevantEvent[] = [];

  interpretAsEvents(groups: LicenseContext[]) {
    const records = this.getRecords(groups);
    this.sortRecords(records);

    const tempEvent = new TempEvent(this.events);

    for (const record of records) {
      if (isLicense(record)) {
        if (isEvalOrOpenSourceLicense(record)) {
          tempEvent.use('eval', record.addonLicenseId);
        }
        else if (isPaidLicense(record)) {
          tempEvent.use('purchase', record.addonLicenseId);
        }
      }
      else if (isTransaction(record)) {
        switch (record.purchaseDetails.saleType) {
          case 'New':
            tempEvent.use('purchase', record.addonLicenseId, record);
            break;
          case 'Renewal':
            this.events.push({ type: 'renewal', transaction: record });
            break;
          case 'Upgrade':
            this.events.push({ type: 'upgrade', transaction: record });
            break;
        }
      }
    }

    tempEvent.finalize();

    return this.events;
  }

  private getRecords(groups: LicenseContext[]) {
    return groups.flatMap(group => {
      const transactions = this.applyRefunds(group.transactions);
      const records: (License | Transaction)[] = [...transactions];

      // Include the License unless it's based on a 'New' Transaction
      if (!transactions.some(t => t.purchaseDetails.saleType === 'New')) {
        records.push(group.license);
      }

      return records;
    });
  }

  private sortRecords(records: (License | Transaction)[]) {
    records.sort((a, b) => {
      // First sort by date
      const date1 = getDate(a);
      const date2 = getDate(b);
      if (date1 < date2) return -1;
      if (date1 > date2) return 1;

      // Evals on the same date always go before other transactions
      const type1 = getLicenseType(a);
      const type2 = getLicenseType(b);
      if (type1 === 'EVALUATION' && type2 !== 'EVALUATION') return -1;
      if (type1 !== 'EVALUATION' && type2 === 'EVALUATION') return -1;

      return 0;
    });
  }

  private applyRefunds(transactions: Transaction[]) {
    const refundedTxIds: string[] = [];

    // Handle refunds fully, either by applying or removing them
    for (const transaction of transactions) {
      if (transaction.purchaseDetails.saleType === 'Refund') {
        const sameDayTransactions = (transactions
          .filter(other =>
            other.purchaseDetails.maintenanceStartDate === transaction.purchaseDetails.maintenanceStartDate &&
            other.purchaseDetails.saleType !== 'Refund'
          )
          .sort(sorter(tx =>
            tx.purchaseDetails.maintenanceStartDate
          ))
        );

        const fullyRefundedTx = sameDayTransactions.find(other =>
          other.purchaseDetails.vendorAmount ===
          -transaction.purchaseDetails.vendorAmount
        );

        if (fullyRefundedTx) {
          refundedTxIds.push(fullyRefundedTx.transactionId);

          // Remove it from the list
          transactions = transactions.filter(tx =>
            tx !== transaction && tx !== fullyRefundedTx
          );
        }
        else {
          const partiallyRefundedTx = sameDayTransactions.find(other =>
            other.purchaseDetails.vendorAmount >
            Math.abs(transaction.purchaseDetails.vendorAmount)
          );

          if (partiallyRefundedTx) {
            // Apply partial refund on first found transaction
            partiallyRefundedTx.purchaseDetails.vendorAmount += transaction.purchaseDetails.vendorAmount;
            transactions = transactions.filter(tx => tx !== transaction);
          }
          else {
            // TODO: Check on a near date instead of this date
          }
        }

        if (transactions.length === 0) {
          this.events.push({
            type: 'refund',
            refundedTxIds,
          });
        }
      }
    }

    return transactions;
  }

}

class TempEvent {

  private insertIndex = -1;

  private state: null | 'eval' | 'purchase' = null;
  private licenseIds: string[] = [];
  private transactions: Transaction[] = [];

  constructor(private events: DealRelevantEvent[]) {
    this.events = events;
  }

  use(type: 'eval' | 'purchase', licenseId: string, transaction?: Transaction) {
    this.state = (this.state === 'purchase' ? 'purchase' : type);
    this.licenseIds.push(licenseId);
    if (transaction) this.transactions.push(transaction);
    if (this.insertIndex === -1) this.insertIndex = this.events.length;
  }

  finalize() {
    if (this.state) {
      this.events.splice(this.insertIndex, 0, {
        type: this.state,
        licenseIds: this.licenseIds,
        transactions: this.transactions,
      });
    }
  }
}

function isEvalOrOpenSourceLicense(record: License) {
  return (
    record.licenseType === 'EVALUATION' ||
    record.licenseType === 'OPEN_SOURCE'
  );
}

function isLicense(record: License | Transaction): record is License {
  return 'maintenanceStartDate' in record;
}

function isTransaction(record: License | Transaction): record is Transaction {
  return 'transactionId' in record;
}

function isPaidLicense(license: License) {
  return (
    license.licenseType === 'ACADEMIC' ||
    license.licenseType === 'COMMERCIAL' ||
    license.licenseType === 'COMMUNITY' ||
    license.licenseType === 'DEMONSTRATION'
  );
}

function getDate(record: License | Transaction) {
  return isLicense(record)
    ? record.maintenanceStartDate
    : record.purchaseDetails.maintenanceStartDate;
}

function getLicenseType(record: License | Transaction) {
  return isLicense(record)
    ? record.licenseType
    : record.purchaseDetails.licenseType;
}
