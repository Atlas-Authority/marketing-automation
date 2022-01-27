import { withAutoClose } from "../util/helpers";
import DataDir from "./dir";
import { DataSet } from "./set";

interface Metadata {
  version: number;
  dirs: string[];
}

class DataManager {

  #metafile = DataDir.root.file('meta.json');
  meta: Metadata;

  constructor() {
    this.meta = this.#read() ?? {
      version: 1,
      dirs: [],
    };
  }

  public newDataSet() {
    const dirName = `in-${Date.now()}`;
    this.meta.dirs.push(dirName);
    this.meta.dirs.sort().reverse();
    this.#save();
    return new DataSet(DataDir.root.subdir(dirName));
  }

  public latestDataSet() {
    if (this.meta.dirs.length === 0) {
      throw new Error(`No data sets available; run engine first`);
    }

    const dirName = this.meta.dirs[0];
    return new DataSet(DataDir.root.subdir(dirName));
  }

  #read(): Metadata | null {
    const lines = [...this.#metafile.readLines()];
    return lines.length > 0 ? JSON.parse(lines.join('\n')) : null;
  }

  #save() {
    withAutoClose(this.#metafile.writeStream(), stream => {
      stream.writeLine(JSON.stringify(this.meta, null, 2));
    });
  }

}

export const dataManager = new DataManager();
