import { LogWriteStream } from "./datadir";

export class CsvStream {

  keyCount = 0;

  constructor(private stream: LogWriteStream) { }

  writeRow(o: object) {
    if (!this.keyCount) {
      const keys = Object.keys(o);
      this.stream.writeLine(keys.join(','));
      this.keyCount = keys.length;
    }
    this.stream.writeLine(Object.values(o).map(o => JSON.stringify(o)).join(','));
  }

  writeBlankRow() {
    this.stream.writeLine(','.repeat(this.keyCount - 1));
  }

}
