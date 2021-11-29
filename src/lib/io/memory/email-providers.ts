import DataDir from "../../cache/datadir";
import { EmailProviderListerService } from "../interfaces";

export class MemoryEmailProviderListerService implements EmailProviderListerService {

  private readonly domains = DataDir.in.file<readonly string[]>('domains.json');

  public async downloadFreeEmailProviders(): Promise<readonly string[]> {
    return this.domains.readJson();
  }

}
