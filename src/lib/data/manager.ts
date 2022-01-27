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
    return new DataSet(DataDir.root.subdir('in'));
  }

  public latestDataSet() {
    return new DataSet(DataDir.root.subdir('in'));
  }

  #read(): Metadata | null {
    const lines = this.#metafile.readLinesIfExists();
    return lines ? JSON.parse([...lines].join('\n')) : null;
  }

  #save() {
    withAutoClose(this.#metafile.writeStream(), stream => {
      stream.writeLine(JSON.stringify(this.meta, null, 2));
    });
  }

}

export const dataManager = new DataManager();
