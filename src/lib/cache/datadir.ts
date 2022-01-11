import fs from "fs";
import { pathToFileURL, URL } from "url";
import log from "../log/logger";
import { isProduction, isTest } from "../parameters/env-config";

const rootDataDir = new URL(`../../data/`, pathToFileURL(__dirname));
if (!fs.existsSync(rootDataDir)) fs.mkdirSync(rootDataDir);

export default class DataDir {

  public static readonly in = new DataDir("in");

  #base: URL;
  #files = new Map<string, DataFile<any>>();

  constructor(place: string) {
    this.#base = new URL(`${place}/`, rootDataDir);
    if (!fs.existsSync(this.#base)) fs.mkdirSync(this.#base);
  }

  public file<T>(filename: string): DataFile<T> {
    let cache = this.#files.get(filename);
    if (!cache) this.#files.set(filename, cache =
      new DataFile<T>(this.#base, filename));
    return cache;
  }

}

class DataFile<T> {

  #url: URL;
  #json?: T;

  /** Don't use this, use DataDir static fields instead. */
  public constructor(base: URL, filename: string) {
    this.#url = new URL(filename, base);
  }

  public readJson(): T {
    if (this.#json === undefined) {
      if (!fs.existsSync(this.#url)) {
        log.error('Dev', `Data file doesn't exist yet; run engine to create`, this.#url);
        process.exit(1);
      }
      const text = fs.readFileSync(this.#url, 'utf8');
      this.#json = JSON.parse(text) as T;
    }
    return this.#json;
  }

  public writeJson(json: T) {
    this.#json = json;
    fs.writeFileSync(this.#url, JSON.stringify(json, null, 2));
  }

  public writeStream(): LogWriteStream {
    if (isTest || isProduction)
      return noopWriteStream;
    else
      return new FileLogWriteStream(this.#url);
  }

}

export interface LogWriteStream {
  close(): void;
  writeLine(text: string): void;
}

export class FileLogWriteStream {

  fd: number;

  constructor(url: URL) {
    this.fd = fs.openSync(url, 'w');
  }

  close() {
    fs.close(this.fd, () => { });
  }

  writeLine(text: string) {
    fs.writeSync(this.fd, text + '\n');
  }

}

const noopWriteStream: LogWriteStream = {
  writeLine() { },
  close() { },
};
