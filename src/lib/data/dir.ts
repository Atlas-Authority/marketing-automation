import fs from "fs";
import { pathToFileURL, URL } from "url";
import { DataFile } from "./file";

const rootDataDir = new URL(`../../data/`, pathToFileURL(__dirname));
if (!fs.existsSync(rootDataDir)) fs.mkdirSync(rootDataDir);

export default class DataDir {

  #base: URL;
  constructor(place: string) {
    this.#base = new URL(`${place}/`, rootDataDir);
    if (!fs.existsSync(this.#base)) fs.mkdirSync(this.#base);
  }

  public file<T extends readonly any[]>(filename: string): DataFile<T> {
    return new DataFile<T>(this.#base, filename);
  }

}
