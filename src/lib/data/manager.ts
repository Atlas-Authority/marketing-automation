import * as luxon from 'luxon';
import { ConsoleLogger } from '../log/console';
import { withAutoClose } from "../util/helpers";
import DataDir from "./dir";
import { DataSetScheduler } from './scheduler';
import { DataSet } from "./set";

interface Metadata {
  version: number;
  timestamps: number[];
}

class DataManager {

  #metafile = DataDir.root.file('meta.json');
  #meta: Metadata;

  #scheduler = DataSetScheduler.fromENV();

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

  public dataSetFrom(ms: number) {
    const dirName = `in-${ms}`;
    if (!this.#meta.timestamps.includes(ms)) {
      throw new Error(`Data set [${dirName}] does not exist`);
    }
    return new DataSet(DataDir.root.subdir(dirName));
  }

  public latestDataSet() {
    if (this.#meta.timestamps.length === 0) {
      throw new Error(`No data sets available; run engine first`);
    }
    return this.dataSetFrom(this.#meta.timestamps[0]);
  }

  public pruneDataSets(console: ConsoleLogger) {
    console.printInfo('Data Manager', 'Preparing to prune data sets');
    console.printInfo('Data Manager', 'Using backup schedule', this.#scheduler.readableSchedule());
    console.printInfo('Data Manager', 'Checking', this.#meta.timestamps.map(readableTimestamp));

    const dirs = this.#meta.timestamps.map(ms => {
      const timestamp = luxon.DateTime.fromMillis(ms);
      return { ms, timestamp };
    });

    const toKeep = (this.#scheduler.check(luxon.DateTime.now(), dirs)
      .map(({ ms }) => ms)
      .reverse());

    const toDelete = this.#meta.timestamps.filter(ms => !toKeep.includes(ms));

    this.#meta.timestamps = toKeep;
    this.#save();

    console.printInfo('Data Manager', 'Keeping', toKeep.map(readableTimestamp));
    console.printInfo('Data Manager', 'Pruning', toDelete.map(readableTimestamp));

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

function readableTimestamp(ms: number) {
  return {
    dir: `in-${ms}`,
    created: luxon.DateTime.fromMillis(ms).toString(),
  };
}
