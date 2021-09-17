import { Transaction } from "../../types/transaction.js";
import { sorter } from "../../util/helpers.js";
import logger from '../../util/logger.js';
import { abbrRecordDetails, getDate, getLicense, getLicenseType, isEvalOrOpenSourceLicense, isLicense, isPaidLicense, isTransaction } from "./records.js";

export type RefundEvent = { type: 'refund', refundedTxs: Transaction[] };
export type EvalEvent = { type: 'eval', licenses: License[] };
export type PurchaseEvent = { type: 'purchase', licenses: License[], transaction?: Transaction };
export type RenewalEvent = { type: 'renewal', transaction: Transaction };
export type UpgradeEvent = { type: 'upgrade', transaction: Transaction };

export type DealRelevantEvent = (
  RefundEvent |
  EvalEvent |
  PurchaseEvent |
  RenewalEvent |
  UpgradeEvent
);

export class EventGenerator {

  events: DealRelevantEvent[] = [];

  interpretAsEvents(groups: LicenseContext[]) {
    const records = this.getRecords(groups);
    this.sortRecords(records);

    for (const record of records) {
      if (isLicense(record)) {
        if (isEvalOrOpenSourceLicense(record)) {
          this.events.push({ type: 'eval', licenses: [record] });
        }
        else if (isPaidLicense(record)) {
          this.events.push({ type: 'purchase', licenses: [record] });
        }
      }
      else if (isTransaction(record)) {
        switch (record.purchaseDetails.saleType) {
          case 'New': {
            const license = getLicense(record.addonLicenseId, groups);
            this.events.push({ type: 'purchase', licenses: [license], transaction: record });
            break;
          }
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

    logger.verbose('Deal Actions', '\n');
    logger.verbose('Deal Actions', 'Records');
    for (const record of records) {
      logger.verbose('Deal Actions', abbrRecordDetails(record));
    }
    logger.verbose('Deal Actions', 'Events');
    for (const e of this.events) {
      logger.verbose('Deal Actions', abbrEventDetails(e))
    }

    return this.events;
  }

  /**
   * Merge all evals into the following purchase.
   * If it's all evals, just merge them into the last.
   * Delete any trailing evals not followed by a purchase.
   */
  private normalizeEvalAndPurchaseEvents() {
    if (this.events.length < 2) return;

    let lastEval: EvalEvent | null = null;

    for (let i = 0; i < this.events.length; i++) {
      const event = this.events[i];

      if (event.type === 'eval') {
        this.events.splice(i--, 1); // Pluck it out

        if (lastEval) {
          lastEval.licenses.push(...event.licenses);
        }
        else {
          lastEval = event;
        }
      }
      else if (event.type === 'purchase' && lastEval) {
        event.licenses.unshift(...lastEval.licenses);
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
    const refundedTxs: Transaction[] = [];

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
          refundedTxs.push(fullyRefundedTx);

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
            refundedTxs,
          });
        }
      }
    }

    return transactions;
  }

}

function abbrEventDetails(e: DealRelevantEvent) {
  switch (e.type) {
    case 'eval': return { type: e.type, ids: e.licenses.map(l => l.addonLicenseId) };
    case 'purchase': return { type: e.type, ids: e.licenses.map(l => l.addonLicenseId), tx: e.transaction?.transactionId };
    case 'refund': return { type: e.type, ids: e.refundedTxs.map(tx => tx.transactionId) };
    case 'renewal': return { type: e.type, id: e.transaction.transactionId };
    case 'upgrade': return { type: e.type, id: e.transaction.transactionId };
  }
}
