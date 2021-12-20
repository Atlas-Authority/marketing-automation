import DataDir from "../../cache/datadir";
import { RawLicense, RawTransaction } from "../../model/marketplace/raw";
import { MarketplaceService } from "../interfaces";
import { License } from "../../model/license";
import { Transaction } from "../../model/transaction";

export class MemoryMarketplace implements MarketplaceService {

  private readonly licensesWith = DataDir.in.file<readonly RawLicense[]>('licenses-with.json');
  private readonly licensesWithout = DataDir.in.file<readonly RawLicense[]>('licenses-without.json');
  private readonly precomputedLicenses = DataDir.in.file<readonly License[]>('precomputed-licenses.json');

  private readonly transactions = DataDir.in.file<readonly RawTransaction[]>('transactions.json');
  private readonly precomputedTransactions = DataDir.in.file<readonly Transaction[]>('precomputed-transactions.json');

  public async downloadTransactions(): Promise<readonly RawTransaction[]> {
    return this.transactions.readJson();
  }

  public async downloadLicensesWithoutDataInsights(): Promise<readonly RawLicense[]> {
    return this.licensesWithout.readJson();
  }

  public async downloadLicensesWithDataInsights(): Promise<readonly RawLicense[]> {
    return this.licensesWith.readJson();
  }

  public async downloadPrecomputedLicenses(): Promise<readonly License[]> {
    return this.precomputedLicenses.readJson();
  }

  public async downloadPrecomputedTransactions(): Promise<readonly Transaction[]> {
    return this.precomputedTransactions.readJson();
  }

}
