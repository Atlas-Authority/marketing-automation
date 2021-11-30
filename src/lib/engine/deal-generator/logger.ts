import Chance from 'chance';
import DataDir, { LogWriteStream } from "../../cache/datadir.js";
import { Table } from "../../log/table.js";
import { DealData } from "../../model/deal.js";
import { License } from "../../model/license.js";
import { Transaction } from "../../model/transaction.js";
import { formatMoney } from "../../util/formatters.js";
import { Action } from "./actions.js";
import { DealRelevantEvent } from "./events.js";

export class DealDataLogger {

  plainLogger = new FileDealDataLogger(
    DataDir.out.file('deal-generator.txt').writeStream(),
    new NonRedactor(),
  );

  rededLogger = new FileDealDataLogger(
    DataDir.out.file('deal-generator-redacted.txt').writeStream(),
    new PrivacyRedactor(),
  );

  close() {
    this.plainLogger.close();
    this.rededLogger.close();
  }

  logActions(actions: Action[]) {
    this.plainLogger.logActions(actions);
    this.rededLogger.logActions(actions);
  }

  logRecords(records: (License | Transaction)[]) {
    this.plainLogger.logRecords(records);
    this.rededLogger.logRecords(records);
  }

  logEvents(events: DealRelevantEvent[]) {
    this.plainLogger.logEvents(events);
    this.rededLogger.logEvents(events);
  }

}

export class FileDealDataLogger {

  constructor(
    private log: LogWriteStream,
    private redact: Redactor,
  ) { }

  close() {
    this.log.close();
  }

  logActions(actions: Action[]) {
    this.log.writeLine('Actions');
    for (const action of actions) {
      switch (action.type) {
        case 'create':
          this.log.writeLine('  Create:');
          this.printDealProperties(action.properties);
          break;
        case 'update':
          this.log.writeLine(`  Update: ${this.redact.dealId(action.deal.id)}`);
          this.printDealProperties(action.properties);
          break;
        case 'noop':
          this.log.writeLine(`  Nothing: ${this.redact.dealId(action.deal.id)}`);
          break;
      }
    }
  }

  private printDealProperties(data: Partial<DealData>) {
    for (const [k, v] of Object.entries(data)) {
      const key = k as keyof DealData;
      const fn = dealPropertyRedactors[key] as <T>(redact: Redactor, val: T) => T;
      const val = fn(this.redact, v);
      this.log.writeLine(`    ${k}: ${val}`);
    }
  }

  logRecords(records: (License | Transaction)[]) {
    const ifTx = (fn: (r: Transaction) => string) =>
      (r: License | Transaction) =>
        r instanceof Transaction ? fn(r) : '';

    this.log.writeLine('\n');
    Table.print({
      log: str => this.log.writeLine(str),
      title: 'Records',
      rows: records,
      cols: [
        [{ title: 'Hosting' }, record => record.data.hosting],
        [{ title: 'AddonLicenseId' }, record => this.redact.addonLicenseId(record.data.addonLicenseId)],
        [{ title: 'Date' }, record => record.data.maintenanceStartDate],
        [{ title: 'LicenseType' }, record => record.data.licenseType],
        [{ title: 'SaleType' }, ifTx(record => record.data.saleType)],
        [{ title: 'Transaction' }, ifTx(record => this.redact.transactionId(record.data.transactionId))],
        [{ title: 'Amount', align: 'right' }, ifTx(record => formatMoney(this.redact.amount(record.data.vendorAmount)))],
      ],
    });
  }

  logEvents(events: DealRelevantEvent[]) {
    const rows = events.map(e => {
      switch (e.type) {
        case 'eval': return {
          type: e.type,
          lics: e.licenses.map(l => this.redact.addonLicenseId(l.id)),
          txs: [],
        };
        case 'purchase': return {
          type: e.type,
          lics: e.licenses.map(l => this.redact.addonLicenseId(l.id)),
          txs: [this.redactedTransaction(e.transaction)],
        };
        case 'refund': return {
          type: e.type,
          lics: [],
          txs: e.refundedTxs.map(tx => tx.id),
        };
        case 'renewal': return {
          type: e.type,
          lics: [],
          txs: [this.redactedTransaction(e.transaction)],
        };
        case 'upgrade': return {
          type: e.type,
          lics: [],
          txs: [this.redactedTransaction(e.transaction)],
        };
      }
    });

    Table.print({
      title: 'Events',
      log: str => this.log.writeLine(str),
      rows: rows,
      cols: [
        [{ title: 'Type' }, row => row.type],
        [{ title: 'Licenses' }, row => row.lics?.join(', ') ?? ''],
        [{ title: 'Transactions' }, row => row.txs?.join(', ') ?? ''],
      ],
    });
  }

  private redactedTransaction(transaction: Transaction | undefined) {
    if (!transaction) return undefined;
    const txid = this.redact.transactionId(transaction.data.transactionId);
    const lid = this.redact.addonLicenseId(transaction.data.addonLicenseId);
    return `${txid}[${lid}]`;
  }

}

type R = string | number | undefined | null;

interface Redactor {

  addonLicenseId<T extends R>(val: T): T;
  transactionId<T extends R>(val: T): T;
  dealId<T extends R>(val: T): T;
  appName<T extends R>(val: T): T;
  dealName<T extends R>(val: T): T;
  product<T extends R>(val: T): T;
  amount<T extends R>(val: T): T;

}

class NonRedactor implements Redactor {

  public addonLicenseId<T extends R>(val: T): T { return val; }
  public transactionId<T extends R>(val: T): T { return val; }
  public dealId<T extends R>(val: T): T { return val; }
  public appName<T extends R>(val: T): T { return val; }
  public dealName<T extends R>(val: T): T { return val; }
  public product<T extends R>(val: T): T { return val; }
  public amount<T extends R>(val: T): T { return val; }

}

class PrivacyRedactor implements Redactor {

  private chance = new Chance();

  private redactions = new Map<string | number, string | number>();
  private newIds = new Set<string | number>();

  private redact<T extends R>(id: T, idgen: () => string | number): T {
    if (id === undefined || id === null) return id;
    let rid = this.redactions.get(id);
    if (!rid) {
      do { rid = idgen(); }
      while (this.newIds.has(rid));
      this.newIds.add(rid);
      this.redactions.set(id, rid)
    };
    return rid as T;
  }

  private shortUUID() {
    return this.chance.string({
      length: 10,
      alpha: true,
      numeric: true,
      symbols: false,
      casing: 'lower'
    });
  }

  public addonLicenseId<T extends R>(val: T): T {
    return this.redact(val, () => `L[${this.shortUUID()}]`);
  }

  public transactionId<T extends R>(val: T): T {
    return this.redact(val, () => `TX[${this.shortUUID()}]`);
  }

  public dealId<T extends R>(val: T): T {
    return this.redact(val, () => `D[${this.shortUUID()}]`);
  }

  public appName<T extends R>(val: T): T {
    return this.redact(val, () => `AppName[${this.chance.word({ capitalize: true, syllables: 2 })}]`);
  }

  public dealName<T extends R>(val: T): T {
    return this.redact(val, () => `DealName[${this.chance.word({ capitalize: true, syllables: 2 })}]`);
  }

  public product<T extends R>(val: T): T {
    return this.redact(val, () => `Product[${this.chance.word({ capitalize: true, syllables: 2 })}]`);
  }

  public amount<T extends R>(val: T): T {
    return this.redact(val, () => this.chance.floating({ min: 0, max: 1_000 }));
  }

}

const dealPropertyRedactors: {
  [K in keyof DealData]: (redact: Redactor, val: Partial<DealData>[K]) => Partial<DealData>[K]
} = {
  addonLicenseId: (redact, addonLicenseId) => redact.addonLicenseId(addonLicenseId),
  amount: (redact, amount) => redact.amount(amount),
  app: (redact, app) => redact.appName(app),
  closeDate: (redact, closeDate) => closeDate,
  country: (redact, country) => country,
  dealName: (redact, dealName) => redact.dealName(dealName),
  dealStage: (redact, dealStage) => dealStage,
  deployment: (redact, deployment) => deployment,
  licenseTier: (redact, licenseTier) => licenseTier,
  origin: (redact, origin) => origin,
  pipeline: (redact, pipeline) => pipeline,
  relatedProducts: (redact, relatedProducts) => redact.product(relatedProducts),
  transactionId: (redact, transactionId) => redact.transactionId(transactionId),
};
