import DataDir from "../../cache/datadir.js";
import { EmailProviderListerService } from "../../io/interfaces.js";

export class MemoryEmailProviderListerService implements EmailProviderListerService {

  readonly domains = DataDir.in.file<readonly string[]>('domains.json');

  async downloadFreeEmailProviders(): Promise<readonly string[]> {
    return this.domains.readJson();
  }

}
