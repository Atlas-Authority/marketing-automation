import fs from "fs";
import { pathToFileURL, URL } from "url";
import { DataFile } from "./file";

export default class DataDir {

  static root = new DataDir('data', new URL(`../../`, pathToFileURL(__dirname)));

  #base: URL;
  private constructor(place: string, base?: URL) {
    this.#base = new URL(`${place}/`, base);
    if (!fs.existsSync(this.#base)) fs.mkdirSync(this.#base);
  }

  public file<T extends readonly any[]>(filename: string): DataFile<T> {
    return new DataFile<T>(new URL(filename, this.#base));
  }

  public subdir(place: string): DataDir {
    return new DataDir(place, this.#base);
  }

}
