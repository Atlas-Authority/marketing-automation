import fs from "fs";
import { pathToFileURL, URL } from "url";
import log from "../log/logger";
import { CsvStream } from "./csv-stream";

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

class DataFile<T extends readonly any[]> {

  #url: URL;
  public constructor(base: URL, filename: string) {
    this.#url = new URL(filename, base);
  }

  public readArray(): T {
    if (!fs.existsSync(this.#url)) {
      log.error('Dev', `Data file doesn't exist yet; run engine to create`, this.#url);
      process.exit(1);
    }
    const text = fs.readFileSync(this.#url, 'utf8');
    return JSON.parse(text) as T;
  }

  public writeArray(json: T) {
    fs.writeFileSync(this.#url, JSON.stringify(json, null, 2));
  }

  public writeStream<T>(fn: (stream: LogWriteStream) => T) {
    const fd = fs.openSync(this.#url, 'w');
    const result = fn({
      writeLine: (text) => {
        fs.writeSync(fd, text + '\n');
      },
    });
    fs.closeSync(fd);
    return result;
  }

  public writeCsvStream<FT>(fn: (stream: CsvStream) => FT): FT {
    return this.writeStream(stream => {
      const csvStream = new CsvStream(stream);
      return fn(csvStream);
    });
  }

}

export interface LogWriteStream {
  writeLine(text: string): void;
}
