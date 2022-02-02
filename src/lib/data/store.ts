import { FullEntity } from "../hubspot/interfaces";
import { RawLicense, RawTransaction } from "../marketplace/raw";
import DataDir from "./dir";
import { RawDataSet } from "./raw";

export class DataSetStore {

  private licensesWithDataInsights;
  private licensesWithoutDataInsights;
  private transactions;
  private tlds;
  private freeDomains;
  private rawDeals;
  private rawCompanies;
  private rawContacts;

  constructor(dataDir: DataDir) {
    this.licensesWithDataInsights = (ext: string) => dataDir.file<RawLicense[]>('licenses-with.' + ext);
    this.licensesWithoutDataInsights = (ext: string) => dataDir.file<RawLicense[]>('licenses-without.' + ext);
    this.transactions = (ext: string) => dataDir.file<RawTransaction[]>('transactions.' + ext);
    this.tlds = (ext: string) => dataDir.file<{ tld: string }[]>('tlds.' + ext);
    this.freeDomains = (ext: string) => dataDir.file<{ domain: string }[]>('domains.' + ext);
    this.rawDeals = (ext: string) => dataDir.file<FullEntity[]>('deals.' + ext);
    this.rawCompanies = (ext: string) => dataDir.file<FullEntity[]>('companies.' + ext);
    this.rawContacts = (ext: string) => dataDir.file<FullEntity[]>('contacts.' + ext);
  }

  load(): RawDataSet {
    return {
      licensesWithDataInsights: this.licensesWithDataInsights('csv').readArray(),
      licensesWithoutDataInsights: this.licensesWithoutDataInsights('csv').readArray(),
      transactions: this.transactions('csv').readArray(),
      tlds: this.tlds('csv').readArray().map(({ tld }) => tld),
      freeDomains: this.freeDomains('csv').readArray().map(({ domain }) => domain),
      rawDeals: this.rawDeals('csv').readArray(),
      rawCompanies: this.rawCompanies('csv').readArray(),
      rawContacts: this.rawContacts('csv').readArray(),
    }
  }

  save(data: RawDataSet) {
    this.transactions('csv').writeArray(data.transactions);
    this.licensesWithoutDataInsights('csv').writeArray(data.licensesWithoutDataInsights);
    this.licensesWithDataInsights('csv').writeArray(data.licensesWithDataInsights);
    this.freeDomains('csv').writeArray(data.freeDomains.map(domain => ({ domain })));
    this.tlds('csv').writeArray(data.tlds.map(tld => ({ tld })));
    this.rawDeals('csv').writeArray(data.rawDeals);
    this.rawCompanies('csv').writeArray(data.rawCompanies);
    this.rawContacts('csv').writeArray(data.rawContacts);
  }

  inflate() {
    const data = this.load();
    this.transactions('json').writeJsonArray(data.transactions);
    this.licensesWithoutDataInsights('json').writeJsonArray(data.licensesWithoutDataInsights);
    this.licensesWithDataInsights('json').writeJsonArray(data.licensesWithDataInsights);
    this.freeDomains('json').writeJsonArray(data.freeDomains.map(domain => ({ domain })));
    this.tlds('json').writeJsonArray(data.tlds.map(tld => ({ tld })));
    this.rawDeals('json').writeJsonArray(data.rawDeals);
    this.rawCompanies('json').writeJsonArray(data.rawCompanies);
    this.rawContacts('json').writeJsonArray(data.rawContacts);
  }

}
