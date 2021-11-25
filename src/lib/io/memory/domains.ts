import DataDir from "../../cache/datadir.js";
import { TldListerService } from "../interfaces.js";

export class MemoryTldListerService implements TldListerService {

  private readonly tlds = DataDir.in.file<readonly string[]>('tlds.json');

  public async downloadAllTlds(): Promise<readonly string[]> {
    return this.tlds.readJson();
  }

}
