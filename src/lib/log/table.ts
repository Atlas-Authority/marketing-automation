type Cell = [string, ('left' | 'right')?];
type Row = Cell[];

export class Table {

  private rows: Row[] = [];

  constructor(private colCount: number) { }

  addRow(row: Cell[]) {
    this.rows.push(row);
  }

  eachRow() {
    const cols: number[] = [];
    for (let i = 0; i < this.colCount; i++) {
      cols.push(Math.max(...this.rows.map(row => row[i][0].length)));
    }

    const padders: { [key: string]: (s: string, colIdx: number) => string } = {
      left: (s, i) => s.padEnd(cols[i], ' '),
      right: (s, i) => s.padStart(cols[i], ' '),
    };

    return this.rows.map(row => (
      row.map((cell, colIndex) => (
        padders[cell[1] ?? 'left'](cell[0], colIndex)
      )).join('  ')
    ));
  }

}
