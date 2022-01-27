import { withAutoClose } from "../util/helpers";
import DataDir from "./dir";

interface Metadata {
}

class DataManager {

  #metafile = DataDir.root.file('meta.json');
  meta: Metadata;

  constructor() {
    this.meta = this.#read() ?? {};
  }

  public newDataDir() {
    return DataDir.root.subdir('in');
  }

  public latestDataDir() {
    return DataDir.root.subdir('in');
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
