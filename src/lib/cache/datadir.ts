import fs from 'fs';
import { URL } from 'url';
import log from '../log/logger.js';

const rootDataDir = new URL(`../../../data/`, import.meta.url);
if (!fs.existsSync(rootDataDir)) fs.mkdirSync(rootDataDir);

export class DataDir {

  static readonly in = new DataDir("in");
  static readonly out = new DataDir("out");
  static readonly cache = new DataDir("cache");

  #base: URL;

  constructor(place: string) {
    this.#base = new URL(`${place}/`, rootDataDir);
    if (!fs.existsSync(this.#base)) fs.mkdirSync(this.#base);
  }

  writeFile(filename: string, contents: string | Buffer) {
    fs.writeFileSync(this.url(filename), contents);
  }

  writeJsonFile(filename: string, contents: unknown) {
    this.writeFile(filename, JSON.stringify(contents, null, 2));
  }

  private readFile(filename: string) {
    if (!this.pathExists(filename)) {
      log.error('Dev', `Data file doesn't exist yet; run engine to create`, this.url(filename));
      process.exit(1);
    }
    return fs.readFileSync(this.url(filename));
  }

  readJsonFile(filename: string) {
    return JSON.parse(this.readFile(filename).toString('utf8'));
  }

  pathExists(filename: string) {
    return fs.existsSync(this.url(filename));
  }

  private url(filename: string) {
    return new URL(filename, this.#base);
  }

}
