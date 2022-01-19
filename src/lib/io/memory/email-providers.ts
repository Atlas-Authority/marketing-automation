import DataDir from "../../cache/datadir";
import { EmailProviderListerService } from "../interfaces";

export class MemoryEmailProviderListerService implements EmailProviderListerService {

  private readonly domains: readonly string[] = [];

  constructor(dataDir: DataDir | null) {
    if (dataDir) {
      this.domains = dataDir.file<readonly string[]>('domains.json').readJson();
    }
  }

  public async downloadFreeEmailProviders(): Promise<readonly string[]> {
    return this.domains;
  }

}
