import DataDir from "../../cache/datadir.js";
import { EmailProviderListerService } from "../interfaces.js";

export class MemoryEmailProviderListerService implements EmailProviderListerService {

  private readonly domains = DataDir.in.file<readonly string[]>('domains.json');

  public async downloadFreeEmailProviders(): Promise<readonly string[]> {
    return this.domains.readJson();
  }

}
