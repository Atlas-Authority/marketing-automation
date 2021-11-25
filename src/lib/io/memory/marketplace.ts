import DataDir from "../../cache/datadir.js";
import { RawLicense, RawTransaction } from "../../model/marketplace/raw.js";
import { MarketplaceService } from "../interfaces.js";

export class MemoryMarketplace implements MarketplaceService {

  private readonly licensesWith = DataDir.in.file<readonly RawLicense[]>('licenses-with.json');
  private readonly licensesWithout = DataDir.in.file<readonly RawLicense[]>('licenses-without.json');
  private readonly transactions = DataDir.in.file<readonly RawTransaction[]>('transactions.json');

  public async downloadTransactions(): Promise<readonly RawTransaction[]> {
    return this.transactions.readJson();
  }

  public async downloadLicensesWithoutDataInsights(): Promise<readonly RawLicense[]> {
    return this.licensesWithout.readJson();
  }

  public async downloadLicensesWithDataInsights(): Promise<readonly RawLicense[]> {
    return this.licensesWith.readJson();
  }

}
