import DataDir from "../../cache/datadir";
import { RawLicense, RawTransaction } from "../../model/marketplace/raw";
import { MarketplaceService } from "../interfaces";

export class MemoryMarketplace implements MarketplaceService {

  private readonly licensesWith: readonly RawLicense[] = [];
  private readonly licensesWithout: readonly RawLicense[] = [];
  private readonly transactions: readonly RawTransaction[] = [];

  constructor(useDiskCache = true) {
    if (useDiskCache) {
      this.licensesWith = DataDir.in.file<readonly RawLicense[]>('licenses-with.json').readJson();
      this.licensesWithout = DataDir.in.file<readonly RawLicense[]>('licenses-without.json').readJson();
      this.transactions = DataDir.in.file<readonly RawTransaction[]>('transactions.json').readJson();
    }
  }

  public async downloadTransactions(): Promise<readonly RawTransaction[]> {
    return this.transactions;
  }

  public async downloadLicensesWithoutDataInsights(): Promise<readonly RawLicense[]> {
    return this.licensesWithout;
  }

  public async downloadLicensesWithDataInsights(): Promise<readonly RawLicense[]> {
    return this.licensesWith;
  }

}
