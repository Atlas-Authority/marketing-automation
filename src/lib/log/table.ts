type Row = string[];

type ColSpec = {
  align?: 'left' | 'right';
  title?: string;
};

export class Table {

  rows: Row[] = [];

  constructor(private colSpecs: ColSpec[]) {
    const useTitles = this.colSpecs.some(s => s.title);
    if (useTitles) {
      this.rows.push(this.colSpecs.map(s => s.title ?? ''));
      this.rows.push(this.colSpecs.map(s => s.title ? '-'.repeat(s.title.length) : ''));
    }
  }

  eachRow() {
    const cols: number[] = [];
    for (let i = 0; i < this.colSpecs.length; i++) {
      cols.push(Math.max(...this.rows.map(row => row[i].length)));
    }

    const padders: { [key: string]: (s: string, colIdx: number) => string } = {
      left: (s, i) => s.padEnd(cols[i], ' '),
      right: (s, i) => s.padStart(cols[i], ' '),
    };

    return this.rows.map(row => (
      row.map((cell, colIndex) => {
        const alignment = this.colSpecs[colIndex].align ?? 'left';
        return padders[alignment](cell, colIndex);
      }).join('   ')
    ));
  }

}
