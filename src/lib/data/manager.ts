import { Console } from '../log/console';
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

  public pruneDataSets(console: Console) {
    // For now this means just keep the latest one

    const toDelete = this.meta.dirs.slice(1);
    this.meta.dirs = this.meta.dirs.slice(0, 1);
    this.#save();

    for (const dirName of toDelete) {
      const dir = DataDir.root.subdir(dirName);
      dir.delete(console);
    }
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
