import Chance from 'chance';
import DataDir, { LogWriteStream } from "../../cache/datadir.js";
import { Table } from "../../log/table.js";
import { DealData } from "../../model/deal.js";
import { License } from "../../model/license.js";
import { Transaction } from "../../model/transaction.js";
import { formatMoney } from "../../util/formatters.js";
import { Action } from "./actions.js";
import { abbrEventDetails, DealRelevantEvent } from "./events.js";

const dealPropertyRedactors: {
  [K in keyof DealData]: (redact: Redactor, val: Partial<DealData>[K]) => Partial<DealData>[K]
} = {
  addonLicenseId: (redact, addonLicenseId) => redact.addonLicenseId(addonLicenseId),
  amount: (redact, amount) => amount,
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

export class DealDataLogger {

  plainLog = DataDir.out.file('deal-generator.txt').writeStream();
  rededLog = DataDir.out.file('deal-generator-redacted.txt').writeStream();

  nonRedactor = new NonRedactor();
  shhRedactor = new PrivacyRedactor();

  close() {
    this.plainLog.close();
    this.rededLog.close();
  }

  logActions(actions: Action[]) {
    this._logActions(this.plainLog, this.nonRedactor, actions);
    this._logActions(this.rededLog, this.shhRedactor, actions);
  }

  printDealProperties(log: LogWriteStream, redact: Redactor, data: Partial<DealData>) {
    for (const [k, v] of Object.entries(data)) {
      const key = k as keyof DealData;
      const fn = dealPropertyRedactors[key] as <T>(redact: Redactor, val: T) => T;
      const val = fn(redact, v);
      log.writeLine(`    ${k}: ${val}`);
    }
  }

  private _logActions(log: LogWriteStream, redact: Redactor, actions: Action[]) {
    log.writeLine('Actions');
    for (const action of actions) {
      switch (action.type) {
        case 'create':
          log.writeLine('  Create:');
          this.printDealProperties(log, redact, action.properties);
          break;
        case 'update':
          log.writeLine(`  Update: ${redact.dealId(action.deal.id)}`);
          this.printDealProperties(log, redact, action.properties);
          break;
        case 'noop':
          log.writeLine(`  Nothing: ${redact.dealId(action.deal.id)}`);
          break;
      }
    }
  }

  logRecords(records: (License | Transaction)[]) {
    this._logRecords(this.plainLog, this.nonRedactor, records);
    this._logRecords(this.rededLog, this.shhRedactor, records);
  }

  private _logRecords(log: LogWriteStream, redact: Redactor, records: (License | Transaction)[]) {
    const ifTx = (fn: (r: Transaction) => string) =>
      (r: License | Transaction) =>
        r instanceof Transaction ? fn(r) : '';

    log.writeLine('\n');
    Table.print({
      log: str => log.writeLine(str),
      title: 'Records',
      rows: records,
      cols: [
        [{ title: 'Hosting' }, record => record.data.hosting],
        [{ title: 'AddonLicenseId' }, record => redact.addonLicenseId(record.data.addonLicenseId)],
        [{ title: 'Date' }, record => record.data.maintenanceStartDate],
        [{ title: 'LicenseType' }, record => record.data.licenseType],
        [{ title: 'SaleType' }, ifTx(record => record.data.saleType)],
        [{ title: 'Transaction' }, ifTx(record => redact.transactionId(record.data.transactionId))],
        [{ title: 'Amount', align: 'right' }, ifTx(record => formatMoney(record.data.vendorAmount))],
      ],
    });
  }

  logEvents(events: DealRelevantEvent[]) {
    this._logEvents(this.plainLog, this.nonRedactor, events);
    this._logEvents(this.rededLog, this.shhRedactor, events);
  }

  private _logEvents(log: LogWriteStream, redact: Redactor, events: DealRelevantEvent[]) {
    const rows = events.map(abbrEventDetails).map(({ type, lics, txs }) => ({
      type,
      lics: lics.map(l => redact.addonLicenseId(l)),
      txs: txs.map(tx => redact.transactionId(tx)),
    }));

    Table.print({
      title: 'Events',
      log: str => log.writeLine(str),
      rows: rows,
      cols: [
        [{ title: 'Type' }, row => row.type],
        [{ title: 'Licenses' }, row => row.lics?.join(', ') ?? ''],
        [{ title: 'Transactions' }, row => row.txs?.join(', ') ?? ''],
      ],
    });
  }

}

type R = string | undefined | null;

interface Redactor {

  addonLicenseId<T extends R>(val: T): T;
  transactionId<T extends R>(val: T): T;
  dealId<T extends R>(val: T): T;
  appName<T extends R>(val: T): T;
  dealName<T extends R>(val: T): T;
  product<T extends R>(val: T): T;

}

class NonRedactor implements Redactor {

  public addonLicenseId<T extends R>(val: T): T { return val; }
  public transactionId<T extends R>(val: T): T { return val; }
  public dealId<T extends R>(val: T): T { return val; }
  public appName<T extends R>(val: T): T { return val; }
  public dealName<T extends R>(val: T): T { return val; }
  public product<T extends R>(val: T): T { return val; }

}

class PrivacyRedactor implements Redactor {

  private chance = new Chance();

  private redactions = new Map<string, string>();
  private newIds = new Set<string>();

  private redact<T extends R>(id: T, idgen: () => string): T {
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

}
