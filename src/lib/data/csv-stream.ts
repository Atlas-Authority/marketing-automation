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

}
