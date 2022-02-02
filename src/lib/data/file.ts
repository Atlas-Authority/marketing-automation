import fs from "fs";
import LineReader from 'n-readlines';
import { URL } from "url";
import { withAutoClose } from "../util/helpers";
import { CsvStream } from "./csv";

export class DataFile<T extends readonly any[]> {

  #url: URL;
  public constructor(url: URL) {
    this.#url = url;
  }

  public readArray(): T {
    return CsvStream.readArrayFromCsvLines(this.readLines()) as T;
  }

  public readLines(): Iterable<string> {
    if (!fs.existsSync(this.#url)) {
      return [];
    }

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
    } as Iterator<string> & Iterable<string>;
  }

  public writeArray(array: T) {
    withAutoClose(this.writeCsvStream(), csv => {
      csv.writeArrayToFile(array);
    });
  }

  public writeJsonArray(array: T) {
    withAutoClose(this.writeStream(), stream => {
      stream.writeLine('[');
      for (const [i, o] of array.entries()) {
        let line = JSON.stringify(o, null, 2);
        if (i < array.length - 1) line += ',';
        stream.writeLine(line);
      }
      stream.writeLine(']');
    });
  }

  public writeStream(): LogWriteStream {
    const fd = fs.openSync(this.#url, 'w');
    return {
      writeLine: (text) => fs.writeSync(fd, text + '\n'),
      close: () => fs.closeSync(fd),
    };
  }

  public writeCsvStream(): CsvStream {
    return new CsvStream(this.writeStream());
  }

}

export interface LogWriteStream {
  writeLine(text: string): void;
  close(): void;
}
