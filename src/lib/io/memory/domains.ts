import DataDir from "../../cache/datadir";
import { TldListerService } from "../interfaces";

export class MemoryTldListerService implements TldListerService {

  private readonly tlds: readonly string[] = [];

  constructor(useDiskCache: boolean) {
    if (useDiskCache) {
      this.tlds = DataDir.in.file<readonly string[]>('tlds.json').readJson();
    }
  }

  public async downloadAllTlds(): Promise<readonly string[]> {
    return this.tlds;
  }

}
