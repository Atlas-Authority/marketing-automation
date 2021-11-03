import fs from 'fs';
import { URL } from 'url';
import log from '../log/logger.js';

const rootDataDir = new URL(`../../../data/`, import.meta.url);
if (!fs.existsSync(rootDataDir)) fs.mkdirSync(rootDataDir);

export default class DataDir {

  static readonly in = new DataDir("in");
  static readonly out = new DataDir("out");
  static readonly cache = new DataDir("cache");

  #base: URL;
  #files = new Map<string, DataFile<any>>();

  constructor(place: string) {
    this.#base = new URL(`${place}/`, rootDataDir);
    if (!fs.existsSync(this.#base)) fs.mkdirSync(this.#base);
  }

  file<T>(filename: string): DataFile<T> {
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

  constructor(base: URL, filename: string) {
    this.#url = new URL(filename, base);
  }

  exists() {
    return fs.existsSync(this.#url);
  }

  readJson(): T {
    if (this.#json === undefined) {
      this.#json = JSON.parse(this.readText()) as T;
    }
    return this.#json;
  }

  readText() {
    if (this.#text == undefined) {
      if (!this.exists()) {
        log.error('Dev', `Data file doesn't exist yet; run engine to create`, this.#url);
        process.exit(1);
      }
      this.#text = fs.readFileSync(this.#url, 'utf8');
    }
    return this.#text;
  }

  writeJson(json: T) {
    this.#json = json;
    this.writeText(JSON.stringify(json, null, 2));
  }

  writeText(text: string) {
    this.#text = text;
    fs.writeFileSync(this.#url, this.#text);
  }

}
