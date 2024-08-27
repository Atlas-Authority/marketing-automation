import { RelatedLicenseSet } from "../license-matching/license-grouper";
import { License } from "../model/license";
import {Transaction, uniqueTransactionLineId} from '../model/transaction'
import { sorter } from "../util/helpers";
import {ConsoleLogger} from '../log/console'

export type EventMeta = 'partner-only' | 'mass-provider-only' | 'partner-and-mass-provider-only' | 'archived-app' | null;

export type RefundEvent = { type: 'refund', refundedTxs: Transaction[] };
export type EvalEvent = { type: 'eval', meta: EventMeta, licenses: License[] };
export type PurchaseEvent = { type: 'purchase', meta: EventMeta, licenses: License[], transaction?: Transaction };
export type RenewalEvent = { type: 'renewal', meta: EventMeta, transaction: Transaction };
export type UpgradeEvent = { type: 'upgrade', meta: EventMeta, transaction: Transaction };

export type DealRelevantEvent = (
  RefundEvent |
  EvalEvent |
  PurchaseEvent |
  RenewalEvent |
  UpgradeEvent
);

type TransactionDeal = DealRelevantEvent & {
  transaction: Transaction
}

function hasTransaction(event: DealRelevantEvent): event is TransactionDeal {
  return (event as any).transaction
}

export class EventGenerator {

  constructor(
    private archivedApps: Set<string>,
    private partnerDomains: Set<string>,
    private freeEmailDomains: Set<string>,
    private console?: ConsoleLogger
  ) { }

  private events: DealRelevantEvent[] = [];

  public interpretAsEvents(records: (License | Transaction)[]) {
    const meta = this.getEventMeta(records);

    for (const record of records) {
      if (record instanceof License) {
        if (isEvalOrOpenSourceLicense(record)) {
          this.events.push({ type: 'eval', meta, licenses: [record] });
        }
        else if (isPaidLicense(record)) {
          this.events.push({ type: 'purchase', meta, licenses: [record] });
        }
      }
      else {
        switch (record.data.saleType) {
          case 'New': {
            this.events.push({ type: 'purchase', meta, licenses: [record.license], transaction: record });
            break;
          }
          case 'Renewal':
            this.events.push({ type: 'renewal', meta, transaction: record });
            break;
          case 'Upgrade':
            this.events.push({ type: 'upgrade', meta, transaction: record });
            break;
        }
      }
    }

    this.normalizeEvalAndPurchaseEvents();

    return this.events;
  }

  private getEventMeta(records: (License | Transaction)[]): EventMeta {
    if (this.archivedApps.has(records[0].data.addonKey)) {
      return 'archived-app';
    }

    const domains = new Set(records
        .filter(license => license.data.technicalContact)
        .map(license => license.data.technicalContact!.email.toLowerCase().split('@')[1]));
    const partnerDomains = [...domains].filter(domain => this.partnerDomains.has(domain));
    const freeEmailDomains = [...domains].filter(domain => this.freeEmailDomains.has(domain));

    if (domains.size == partnerDomains.length + freeEmailDomains.length) {
      if (partnerDomains.length > 0 && freeEmailDomains.length > 0) {
        return 'partner-and-mass-provider-only';
      }
      else if (partnerDomains.length > 0) {
        return 'partner-only';
      }
      else if (freeEmailDomains.length > 0) {
        return 'mass-provider-only';
      }
    }
    return null;
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

  public getSortedRecords(group: RelatedLicenseSet) {
    return group.flatMap(license => {
      const transactions = this.applyRefunds(license.transactions);
      const records: (License | Transaction)[] = [...transactions];

      // Include the License unless it's based on a 'New' Transaction
      if (!transactions.some(t => t.data.saleType === 'New')) {
        records.push(license);
      }

      return records;
    }).sort((a, b) => {
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

  private applyRefunds(transactions: Transaction[]) {
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

          fullyRefundedTx.refunded = true;

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

        this.events.push({
          type: 'refund',
          refundedTxs,
        });
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

function isEvalOrOpenSourceLicense(record: License) {
  return (
    record.data.licenseType === 'EVALUATION' ||
    record.data.licenseType === 'OPEN_SOURCE'
  );
}

function isPaidLicense(license: License) {
  return (
    license.data.licenseType === 'ACADEMIC' ||
    license.data.licenseType === 'COMMERCIAL' ||
    license.data.licenseType === 'COMMUNITY' ||
    license.data.licenseType === 'DEMONSTRATION'
  );
}
