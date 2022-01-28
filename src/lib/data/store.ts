import { FullEntity } from "../hubspot/interfaces";
import { RawLicense, RawTransaction } from "../marketplace/raw";
import DataDir from "./dir";
import { DataSet } from "./set";

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
    this.licensesWithDataInsights = dataDir.file<RawLicense[]>('licenses-with.csv');
    this.licensesWithoutDataInsights = dataDir.file<RawLicense[]>('licenses-without.csv');
    this.transactions = dataDir.file<RawTransaction[]>('transactions.csv');
    this.tlds = dataDir.file<{ tld: string }[]>('tlds.csv');
    this.freeDomains = dataDir.file<{ domain: string }[]>('domains.csv');
    this.rawDeals = dataDir.file<FullEntity[]>('deals.csv');
    this.rawCompanies = dataDir.file<FullEntity[]>('companies.csv');
    this.rawContacts = dataDir.file<FullEntity[]>('contacts.csv');
  }

  load(): DataSet {
    return {
      licensesWithDataInsights: this.licensesWithDataInsights.readArray(),
      licensesWithoutDataInsights: this.licensesWithoutDataInsights.readArray(),
      transactions: this.transactions.readArray(),
      tlds: this.tlds.readArray().map(({ tld }) => tld),
      freeDomains: this.freeDomains.readArray().map(({ domain }) => domain),
      rawDeals: this.rawDeals.readArray(),
      rawCompanies: this.rawCompanies.readArray(),
      rawContacts: this.rawContacts.readArray(),
    }
  }

  save(data: DataSet) {
    this.transactions.writeArray(data.transactions);
    this.licensesWithoutDataInsights.writeArray(data.licensesWithoutDataInsights);
    this.licensesWithDataInsights.writeArray(data.licensesWithDataInsights);
    this.freeDomains.writeArray(data.freeDomains.map(domain => ({ domain })));
    this.tlds.writeArray(data.tlds.map(tld => ({ tld })));
    this.rawDeals.writeArray(data.rawDeals);
    this.rawCompanies.writeArray(data.rawCompanies);
    this.rawContacts.writeArray(data.rawContacts);
  }

}
