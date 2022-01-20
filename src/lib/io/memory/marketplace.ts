import DataDir from "../../data/datadir";
import { RawLicense, RawTransaction } from "../../model/marketplace/raw";
import { MarketplaceService } from "../interfaces";

export class MemoryMarketplace implements MarketplaceService {

  private readonly licensesWith: readonly RawLicense[] = [];
  private readonly licensesWithout: readonly RawLicense[] = [];
  private readonly transactions: readonly RawTransaction[] = [];

  constructor(dataDir: DataDir | null) {
    if (dataDir) {
      this.licensesWith = dataDir.file<readonly RawLicense[]>('licenses-with.csv').readArray();
      this.licensesWithout = dataDir.file<readonly RawLicense[]>('licenses-without.csv').readArray();
      this.transactions = dataDir.file<readonly RawTransaction[]>('transactions.csv').readArray();
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
