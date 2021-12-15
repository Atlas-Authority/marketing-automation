import fs from "fs";
import { pathToFileURL, URL } from "url";
import log from "../log/logger";
import env from "../parameters/env";

function createRootDataDir(rootDataDir?: URL) {
  const dataDir = rootDataDir ?? new URL(`../../data/`, pathToFileURL(__dirname));
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);
  return dataDir;
}

export default class DataDir {

  public static readonly in = new DataDir("in");
  public static readonly out = new DataDir("out");
  public static readonly cache = new DataDir("cache");

  static inDir(rootDataDir?: URL) {
    return new DataDir('in', rootDataDir);
  }

  #base: URL;
  #files = new Map<string, DataFile<any>>();

  public constructor(place: string, customRootDataDir?: URL) {
    const rootDataDir = createRootDataDir(customRootDataDir);
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

export class DataFile<T> {

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

  public jsonWriteStream(): JsonLogWriteStream {
    if (env.isTest || env.isProduction)
      return noopJsonWriteStream;
    else
      return new FileJsonLogWriteStream(this.#url);
  }

}

export interface LogWriteStream {
  enabled: boolean;
  close(): void;
  writeLine(text?: string): void;
}

export interface JsonLogWriteStream extends LogWriteStream {
  writeJson(json: any, replacer?: (key: string, value: any) => any): void;
}

export class FileLogWriteStream implements LogWriteStream{

  enabled: boolean;
  stream: fs.WriteStream;

  constructor(url: URL) {
    this.enabled = true;
    this.stream = fs.createWriteStream(url);
  }

  close() {
    this.stream.end();
  }

  writeLine(text?: string) {
    this.stream.write((text ?? '') + '\n');
  }

}

export class FileJsonLogWriteStream extends FileLogWriteStream implements JsonLogWriteStream {
  writeJson(json: any, replacer?: (key: string, value: any) => any) {
    this.stream.write(JSON.stringify(json, replacer, 2) + '\n');
  }
}

const noopWriteStream: LogWriteStream = {
  enabled: false,
  writeLine() { },
  close() { },
};

const noopJsonWriteStream: JsonLogWriteStream = {
  enabled: false,
  writeLine() { },
  writeJson() { },
  close() { },
}
