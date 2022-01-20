import { flatten, unflatten } from 'flat';
import fs from "fs";
import LineReader from 'n-readlines';
import { URL } from "url";
import log from "../log/logger";
import { CsvStream } from "./csv-stream";

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

    let keys: string[] | undefined;
    const array: any[] = [];

    const reader = new LineReader(this.#url);
    let lineBuffer;
    while (lineBuffer = reader.next()) {
      const line = lineBuffer.toString('utf-8');

      if (!keys) {
        keys = line.split(',');
        continue;
      }

      const vals = JSON.parse(`[${line}]`);
      const entries = keys.map((key, i) => [key, vals[i]]);
      const normalized = entries.filter(([k, v]) => v !== null && v !== undefined);
      const object = Object.fromEntries(normalized);
      const restored = unflatten(object);
      array.push(restored);
    }

    return array as unknown as T;
  }

  public writeArray(array: T) {
    const keySet = new Set<string>();
    for (const item of array) {
      for (const key of Object.keys(flatten(item))) {
        keySet.add(key);
      }
    }

    this.writeCsvStream(csv => {
      const keys = [...keySet];
      csv.writeHeader(keys);

      for (const item of array) {
        const flattened = flatten(item) as any;
        const orderedValues: any[] = [];
        for (const key of keys) {
          orderedValues.push(flattened[key]);
        }
        while (orderedValues.length > 1) {
          const lastVal = orderedValues[orderedValues.length - 1];
          if (lastVal === undefined || lastVal === null) {
            orderedValues.pop();
          }
          else {
            break;
          }
        }
        csv.writeValueRow(orderedValues);
      }
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
