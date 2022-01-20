import { flatten, unflatten } from 'flat';
import { LogWriteStream } from "./file";

export class CsvStream {

  keyCount = 0;

  constructor(private stream: LogWriteStream) { }

  writeHeader(keys: string[]) {
    if (this.keyCount) throw new Error('Writing CSV header more than once');
    this.stream.writeLine(keys.join(','));
    this.keyCount = keys.length;
  }

  writeObjectRow(o: object) {
    if (!this.keyCount) {
      this.writeHeader(Object.keys(o));
    }
    this.writeValueRow(Object.values(o));
  }

  writeValueRow(values: any[]) {
    this.stream.writeLine(JSON.stringify(values).slice(1, -1));
  }

  writeBlankRow() {
    this.stream.writeLine(','.repeat(this.keyCount - 1));
  }

  static readFileFromFile(lines: Iterable<string>): unknown {
    let keys: string[] | undefined;
    const array: any[] = [];

    for (const line of lines) {
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

    return array;
  }

  writeArrayToFile(array: readonly any[]) {
    const keySet = new Set<string>();
    for (const item of array) {
      for (const key of Object.keys(flatten(item))) {
        keySet.add(key);
      }
    }

    const keys = [...keySet];
    this.writeHeader(keys);

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
      this.writeValueRow(orderedValues);
    }
  }

}
