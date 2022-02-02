import { flatten } from 'flat';
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

  static readArrayFromCsvLines(lines: Iterable<string>): unknown {
    let keys: string[] | undefined;
    let unflattener!: Unflattener;
    const array: any[] = [];

    for (const line of lines) {
      if (!keys) {
        keys = line.split(',');
        unflattener = new Unflattener(keys);
        continue;
      }

      const vals = JSON.parse(`[${line}]`);
      const restored = unflattener.run(vals);
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

  close() {
    this.stream.close();
  }

}

class Unflattener {

  #specs: {
    parts: string[],
    isArray: boolean,
    lastKey: string | number,
  }[] = [];

  constructor(keys: string[]) {
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const parts = key.split('.');
      const last = parts.pop()!;
      const lastKey = +last >= 0 ? +last : last;
      const isArray = typeof lastKey === 'number';
      this.#specs.push({ parts, isArray, lastKey });
    }
  }

  run(vals: any[]) {
    const o = Object.create(null);

    for (let i = 0; i < this.#specs.length; i++) {
      const val = vals[i];
      if (val === undefined || val === null) continue;

      const { isArray, parts, lastKey } = this.#specs[i];
      let sub = o;
      for (let i = 0; i < parts.length; i++) {
        sub = sub[parts[i]] ??= (isArray ? [] : Object.create(null));
      }
      sub[lastKey] = val;
    }

    return o;
  }

}
