import fs from "fs";
import LineReader from 'n-readlines';
import { URL } from "url";
import log from "../log/logger";
import { CsvStream } from "./csv";

export class DataFile<T extends readonly any[]> {

  #url: URL;
  public constructor(base: URL, filename: string) {
    this.#url = new URL(filename, base);
  }

  public readArray(): T {
    if (!fs.existsSync(this.#url)) {
      log.error('Dev', `Data file doesn't exist yet; run engine to create`, this.#url);
      process.exit(1);
    }

    return CsvStream.readFileFromFile(this.readLines()) as T;
  }

  public readLines(): Iterator<string> & Iterable<string> {
    const reader = new LineReader(this.#url);
    return {
      [Symbol.iterator]() {
        return this;
      },
      next(): { done: boolean, value: string } {
        const buf = reader.next();
        if (!buf) return { done: true, value: '' };
        return { done: false, value: buf.toString('utf8') }
      },
    };
  }

  public writeArray(array: T) {
    this.writeCsvStream(csv => {
      csv.writeArrayToFile(array);
    });
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
