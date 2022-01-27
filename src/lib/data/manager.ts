import { ConsoleLogger } from '../log/console';
import { withAutoClose } from "../util/helpers";
import DataDir from "./dir";
import { DataSet } from "./set";

interface Metadata {
  version: number;
  timestamps: number[];
}

class DataManager {

  #metafile = DataDir.root.file('meta.json');
  #meta: Metadata;

  constructor() {
    this.#meta = this.#read() ?? {
      version: 2,
      timestamps: [],
    };
  }

  public newDataSet() {
    const ms = Date.now();
    this.#meta.timestamps.unshift(ms);
    this.#save();
    return new DataSet(DataDir.root.subdir(`in-${ms}`));
  }

  public latestDataSet() {
    if (this.#meta.timestamps.length === 0) {
      throw new Error(`No data sets available; run engine first`);
    }

    const ms = this.#meta.timestamps[0];
    return new DataSet(DataDir.root.subdir(`in-${ms}`));
  }

  public pruneDataSets(console: ConsoleLogger) {
    // For now this means just keep the latest one

    const toDelete = this.#meta.timestamps.slice(1);
    this.#meta.timestamps = this.#meta.timestamps.slice(0, 1);
    this.#save();

    for (const ms of toDelete) {
      const dir = DataDir.root.subdir(`in-${ms}`);
      dir.delete(console);
    }
  }

  #read(): Metadata | null {
    const lines = [...this.#metafile.readLines()];
    return lines.length > 0 ? JSON.parse(lines.join('\n')) : null;
  }

  #save() {
    withAutoClose(this.#metafile.writeStream(), stream => {
      stream.writeLine(JSON.stringify(this.#meta, null, 2));
    });
  }

}

export const dataManager = new DataManager();
