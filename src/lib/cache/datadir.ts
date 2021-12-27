import fs from "fs";
import { pathToFileURL, URL } from "url";
import log from "../log/logger";
import env from "../parameters/env-config";

const rootDataDir = new URL(`../../data/`, pathToFileURL(__dirname));
if (!fs.existsSync(rootDataDir)) fs.mkdirSync(rootDataDir);

export default class DataDir {

  public static readonly in = new DataDir("in");
  public static readonly out = new DataDir("out");
  public static readonly cache = new DataDir("cache");

  #base: URL;
  #files = new Map<string, DataFile<any>>();

  private constructor(place: string) {
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
  #text?: string;
  #json?: T;

  /** Don't use this, use DataDir static fields instead. */
  public constructor(base: URL, filename: string) {
    this.#url = new URL(filename, base);
  }

  public exists() {
    return fs.existsSync(this.#url);
  }

  public readJson(): T {
    if (this.#json === undefined) {
      this.#json = JSON.parse(this.readText()) as T;
    }
    return this.#json;
  }

  public readText() {
    if (this.#text == undefined) {
      if (!this.exists()) {
        log.error('Dev', `Data file doesn't exist yet; run engine to create`, this.#url);
        process.exit(1);
      }
      this.#text = fs.readFileSync(this.#url, 'utf8');
    }
    return this.#text;
  }

  public writeJson(json: T) {
    this.#json = json;
    this.writeText(JSON.stringify(json, null, 2));
  }

  public writeText(text: string) {
    this.#text = text;
    fs.writeFileSync(this.#url, this.#text);
  }

  public writeStream(): LogWriteStream {
    if (env.isTest || env.isProduction)
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

  stream: fs.WriteStream;

  constructor(url: URL) {
    this.stream = fs.createWriteStream(url);
  }

  close() {
    this.stream.end();
  }

  writeLine(text: string) {
    this.stream.write(text + '\n');
  }

}

const noopWriteStream: LogWriteStream = {
  writeLine() { },
  close() { },
};
