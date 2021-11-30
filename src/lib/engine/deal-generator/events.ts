import { License } from "../../model/license";
import { Transaction } from "../../model/transaction";
import { sorter } from "../../util/helpers";
import { RelatedLicenseSet } from "../license-matching/license-grouper";
import { DealDataLogger } from "./logger";
import { getLicense, isEvalOrOpenSourceLicense, isPaidLicense } from "./records";

export type RefundEvent = { type: 'refund', groups: RelatedLicenseSet, refundedTxs: Transaction[] };
export type EvalEvent = { type: 'eval', groups: RelatedLicenseSet, licenses: License[] };
export type PurchaseEvent = { type: 'purchase', groups: RelatedLicenseSet, licenses: License[], transaction?: Transaction };
export type RenewalEvent = { type: 'renewal', groups: RelatedLicenseSet, transaction: Transaction };
export type UpgradeEvent = { type: 'upgrade', groups: RelatedLicenseSet, transaction: Transaction };

export type DealRelevantEvent = (
  RefundEvent |
  EvalEvent |
  PurchaseEvent |
  RenewalEvent |
  UpgradeEvent
);

export class EventGenerator {

  constructor(private log: DealDataLogger) { }

  private events: DealRelevantEvent[] = [];

  public interpretAsEvents(groups: RelatedLicenseSet) {
    const records = this.getRecords(groups);
    this.sortRecords(records);
    this.log.logRecords(records);

    for (const record of records) {
      if (record instanceof License) {
        if (isEvalOrOpenSourceLicense(record)) {
          this.events.push({ type: 'eval', groups, licenses: [record] });
        }
        else if (isPaidLicense(record)) {
          this.events.push({ type: 'purchase', groups, licenses: [record] });
        }
      }
      else {
        switch (record.data.saleType) {
          case 'New': {
            const license = getLicense(record.data.addonLicenseId, groups);
            this.events.push({ type: 'purchase', groups, licenses: [license], transaction: record });
            break;
          }
          case 'Renewal':
            this.events.push({ type: 'renewal', groups, transaction: record });
            break;
          case 'Upgrade':
            this.events.push({ type: 'upgrade', groups, transaction: record });
            break;
        }
      }
    }

    this.normalizeEvalAndPurchaseEvents();

    this.log.logEvents(this.events);

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

  private getRecords(groups: RelatedLicenseSet) {
    return groups.flatMap(group => {
      const transactions = this.applyRefunds(group.transactions, groups);
      const records: (License | Transaction)[] = [...transactions];

      // Include the License unless it's based on a 'New' Transaction
      if (!transactions.some(t => t.data.saleType === 'New')) {
        records.push(group.license);
      }

      return records;
    });
  }

  private sortRecords(records: (License | Transaction)[]) {
    records.sort((a, b) => {
      // First sort by date
      const date1 = a.data.maintenanceStartDate;
      const date2 = b.data.maintenanceStartDate;
      if (date1 < date2) return -1;
      if (date1 > date2) return 1;

      // Evals on the same date always go before other transactions
      const type1 = a.data.licenseType;
      const type2 = b.data.licenseType;
      if (type1 === 'EVALUATION' && type2 !== 'EVALUATION') return -1;
      if (type1 !== 'EVALUATION' && type2 === 'EVALUATION') return -1;

      return 0;
    });
  }

  private applyRefunds(transactions: Transaction[], groups: RelatedLicenseSet) {
    const refundedTxs: Transaction[] = [];

    // Handle refunds fully, either by applying or removing them
    for (const transaction of transactions) {
      if (transaction.data.saleType === 'Refund') {
        const sameDayTransactions = (transactions
          .filter(other =>
            other.data.maintenanceStartDate === transaction.data.maintenanceStartDate &&
            other.data.saleType !== 'Refund'
          )
          .sort(sorter(tx =>
            tx.data.maintenanceStartDate
          ))
        );

        const fullyRefundedTx = sameDayTransactions.find(other =>
          other.data.vendorAmount ===
          -transaction.data.vendorAmount
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
            other.data.vendorAmount >
            Math.abs(transaction.data.vendorAmount)
          );

          if (partiallyRefundedTx) {
            // Apply partial refund on first found transaction
            partiallyRefundedTx.data.vendorAmount += transaction.data.vendorAmount;
            transactions = transactions.filter(tx => tx !== transaction);
          }
          else {
            // TODO: Check on a near date instead of this date
          }
        }

        if (transactions.length === 0) {
          this.events.push({
            type: 'refund',
            groups,
            refundedTxs,
          });
        }
      }
    }

    return transactions;
  }

}

export function abbrEventDetails(e: DealRelevantEvent) {
  switch (e.type) {
    case 'eval': return { type: e.type, lics: e.licenses.map(l => l.id) };
    case 'purchase': return { type: e.type, lics: e.licenses.map(l => l.id), txs: [e.transaction?.id] };
    case 'refund': return { type: e.type, txs: e.refundedTxs.map(tx => tx.id) };
    case 'renewal': return { type: e.type, txs: [e.transaction.id] };
    case 'upgrade': return { type: e.type, txs: [e.transaction.id] };
  }
}
