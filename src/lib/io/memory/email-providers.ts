import DataDir from "../../data/datadir";
import { EmailProviderListerService } from "../interfaces";

export class MemoryEmailProviderListerService implements EmailProviderListerService {

  private readonly domains: readonly string[] = [];

  constructor(dataDir: DataDir | null) {
    if (dataDir) {
      this.domains = dataDir.file<readonly { domain: string }[]>('domains.csv').readArray().map(({ domain }) => domain);
    }
  }

  public async downloadFreeEmailProviders(): Promise<readonly string[]> {
    return this.domains;
  }

}
