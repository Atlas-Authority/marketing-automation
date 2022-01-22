import { FullEntity } from "../hubspot/interfaces";
import { RawLicense, RawTransaction } from "../marketplace/raw";
import DataDir from "./dir";

export interface Data {
  tlds: readonly string[];
  licensesWithDataInsights: readonly RawLicense[];
  licensesWithoutDataInsights: readonly RawLicense[];
  transactions: readonly RawTransaction[];
  freeDomains: readonly string[];
  rawDeals: readonly FullEntity[];
  rawCompanies: readonly FullEntity[];
  rawContacts: readonly FullEntity[];
}

export class DataSet {

  private licensesWithDataInsights;
  private licensesWithoutDataInsights;
  private transactions;
  private tlds;
  private freeDomains;
  private rawDeals;
  private rawCompanies;
  private rawContacts;

  constructor(dataDir: DataDir) {
    this.licensesWithDataInsights = dataDir.file<readonly RawLicense[]>('licenses-with.csv');
    this.licensesWithoutDataInsights = dataDir.file<readonly RawLicense[]>('licenses-without.csv');
    this.transactions = dataDir.file<readonly RawTransaction[]>('transactions.csv');
    this.tlds = dataDir.file<readonly { tld: string }[]>('tlds.csv');
    this.freeDomains = dataDir.file<readonly { domain: string }[]>('domains.csv');
    this.rawDeals = dataDir.file<readonly FullEntity[]>('deals.csv');
    this.rawCompanies = dataDir.file<readonly FullEntity[]>('companies.csv');
    this.rawContacts = dataDir.file<readonly FullEntity[]>('contacts.csv');
  }

  load(): Data {
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

  save(data: Data) {
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
