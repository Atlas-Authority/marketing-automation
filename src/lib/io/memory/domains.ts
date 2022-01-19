import DataDir from "../../cache/datadir";
import { TldListerService } from "../interfaces";

export class MemoryTldListerService implements TldListerService {

  private readonly tlds: readonly string[] = [];

  constructor(dataDir: DataDir | null) {
    if (dataDir) {
      this.tlds = dataDir.file<readonly string[]>('tlds.json').readJson();
    }
  }

  public async downloadAllTlds(): Promise<readonly string[]> {
    return this.tlds;
  }

}
