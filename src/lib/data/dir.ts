import del from 'del';
import fs from "fs";
import { fileURLToPath, pathToFileURL, URL } from "url";
import { ConsoleLogger } from '../log/console';
import { DataFile } from "./file";

export default class DataDir {

  static root = new DataDir('data', new URL(`../../`, pathToFileURL(__dirname)));

  #url: URL;
  private constructor(place: string, base?: URL) {
    this.#url = new URL(`${place}/`, base);
    if (!fs.existsSync(this.#url)) fs.mkdirSync(this.#url);
  }

  public file<T extends readonly any[]>(filename: string): DataFile<T> {
    return new DataFile<T>(new URL(filename, this.#url));
  }

  public subdir(place: string): DataDir {
    return new DataDir(place, this.#url);
  }

  public delete(console: ConsoleLogger) {
    const absolutePath = fileURLToPath(this.#url);
    console.printInfo('Pruning', absolutePath);
    try {
      del.sync(absolutePath);
    }
    catch (e: any) {
      console.printWarning('Pruning', 'Failed to delete file', e.message, e.stack);
    }
  }

}
