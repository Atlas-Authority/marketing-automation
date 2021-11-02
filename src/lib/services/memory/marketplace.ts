import DataDir from "../../cache/datadir.js";
import { MarketplaceService } from "../../io/interfaces.js";
import { RawLicense, RawTransaction } from "../../model/marketplace/raw.js";

export class MemoryMarketplace implements MarketplaceService {

  readonly licensesWith = DataDir.in.file<readonly RawLicense[]>('licenses-with.json');
  readonly licensesWithout = DataDir.in.file<readonly RawLicense[]>('licenses-without.json');
  readonly transactions = DataDir.in.file<readonly RawTransaction[]>('transactions.json');

  async downloadTransactions(): Promise<readonly RawTransaction[]> {
    return this.transactions.readJson();
  }

  async downloadLicensesWithoutDataInsights(): Promise<readonly RawLicense[]> {
    return this.licensesWithout.readJson();
  }

  async downloadLicensesWithDataInsights(): Promise<readonly RawLicense[]> {
    return this.licensesWith.readJson();
  }

}
