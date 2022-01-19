import { LogWriteStream } from "./datadir";

export class CsvStream {

  keyCount = 0;

  constructor(private stream: LogWriteStream) { }

  writeHeader(keys: string[]) {
    if (this.keyCount) throw new Error('Writing CSV header more than once');
    this.stream.writeLine(keys.join(','));
    this.keyCount = keys.length;
  }

  writeRow(o: object) {
    if (!this.keyCount) {
      this.writeHeader(Object.keys(o));
    }
    this.stream.writeLine(Object.values(o).map(o => JSON.stringify(o)).join(','));
  }

  writeBlankRow() {
    this.stream.writeLine(','.repeat(this.keyCount - 1));
  }

}
