import DataDir from "../../cache/datadir.js";
import { TldListerService } from "../interfaces.js";

export class MemoryTldListerService implements TldListerService {

  readonly tlds = DataDir.in.file<readonly string[]>('tlds.json');

  async downloadAllTlds(): Promise<readonly string[]> {
    return this.tlds.readJson();
  }

}
