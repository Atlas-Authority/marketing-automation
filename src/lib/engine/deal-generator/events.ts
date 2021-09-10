import { sorter } from "../../util/helpers.js";

export type DealRelevantEvent = (
  { type: 'refund', refundedTxIds: string[] } |
  { type: 'eval', licenseIds: string[] } |
  { type: 'purchase', licenseIds: string[], transaction?: Transaction } |
  { type: 'renewal', transaction: Transaction } |
  { type: 'upgrade', transaction: Transaction }
);

export class EventGenerator {

  events: DealRelevantEvent[] = [];

  interpretAsEvents(groups: LicenseContext[]) {
    const records = this.getRecords(groups);
    this.sortRecords(records);

    for (const record of records) {
      if (isLicense(record)) {
        if (isEvalOrOpenSourceLicense(record)) {
          this.events.push({ type: 'eval', licenseIds: [record.addonLicenseId] });
        }
        else if (isPaidLicense(record)) {
          this.events.push({ type: 'purchase', licenseIds: [record.addonLicenseId] });
        }
      }
      else if (isTransaction(record)) {
        switch (record.purchaseDetails.saleType) {
          case 'New':
            this.events.push({ type: 'purchase', licenseIds: [record.addonLicenseId], transaction: record });
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

    this.normalizeEvalAndPurchaseEvents();

    return this.events;
  }

  /**
   * Merge all evals into the following purchase.
   * If it's all evals, just merge them into the last.
   * Delete any trailing evals not followed by a purchase.
   */
  private normalizeEvalAndPurchaseEvents() {
    if (this.events.length < 2) return;

    let lastEval: { type: 'eval'; licenseIds: string[] } | null = null;

    for (let i = 0; i < this.events.length; i++) {
      const event = this.events[i];

      if (event.type === 'eval') {
        this.events.splice(i--, 1); // Pluck it out

        if (lastEval) {
          lastEval.licenseIds.push(...event.licenseIds);
        }
        else {
          lastEval = event;
        }
      }
      else if (event.type === 'purchase' && lastEval) {
        event.licenseIds.unshift(...lastEval.licenseIds);
        lastEval = null;
      }
    }

    if (this.events.length === 0 && lastEval) {
      this.events = [lastEval];
    }
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
