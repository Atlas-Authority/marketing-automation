type Row = (string | string[])[];

type ColSpec = {
  align?: 'left' | 'right';
  title?: string;
};

export class Table {

  public static print<T>(opts: {
    log: (s: string) => void,
    title: string,
    rows: Iterable<T>,
    cols: [ColSpec, (t: T) => string | string[]][],
  }) {
    opts.log(opts.title);
    const table = new Table(opts.cols.map(([spec,]) => spec));
    for (const row of opts.rows) {
      table.rows.push(opts.cols.map(([, fn]) => fn(row)));
    }
    for (const row of table.eachRow()) {
      opts.log('  ' + row);
    }
  }

  public static toString<T>(opts: {
    rows: Iterable<T>,
    cols: [ColSpec, (t: T) => string | string[]][],
  }) {
    const table = new Table(opts.cols.map(([spec,]) => spec));
    for (const row of opts.rows) {
      table.rows.push(opts.cols.map(([, fn]) => fn(row)));
    }
    return table.eachRow().join('\n');
  }

  public rows: Row[] = [];

  public constructor(private colSpecs: ColSpec[]) {
    const useTitles = this.colSpecs.some(s => s.title);
    if (useTitles) {
      this.rows.push(this.colSpecs.map(s => s.title ?? ''));
      this.rows.push(this.colSpecs.map(s => s.title ? '-'.repeat(s.title.length) : ''));
    }
  }

  public eachRow() {
    const cols: number[] = [];
    for (let i = 0; i < this.colSpecs.length; i++) {
      cols.push(Math.max(...this.rows.map(row => row[i].length)));
    }

    const padders: Record<string, (s: string, colIdx: number) => string> = {
      left: (s, i) => s.padEnd(cols[i], ' '),
      right: (s, i) => s.padStart(cols[i], ' '),
    };

    return this.rows.map(row => {
      const joiner = '   ';
      const rowString = row.map((cell, colIndex) => {
        const alignment = this.colSpecs[colIndex].align ?? 'left';

        let cellString = cell;
        if (Array.isArray(cellString)) {
          const padding = '  ' + (cols
            .slice(0, colIndex)
            .map(n => ' '.repeat(n) + joiner));
          cellString = cellString.join('\n' + padding);
        }

        return padders[alignment](cellString, colIndex);
      }).join(joiner);

      return rowString;
    });
  }

}
