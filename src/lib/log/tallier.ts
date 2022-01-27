import { formatMoney } from "../util/formatters";
import { ConsoleLogger } from "./console";
import { Table } from "./table";

export class Tallier {

  private tally: [string, number, number][] = [];
  public first(reason: string, n: number) { this.tally.push([reason, n, 1]); }
  public less(reason: string, n: number) { this.tally.push([reason, n, -1]); }

  constructor(private console?: ConsoleLogger) { }

  public printTable() {
    const remainder = (this.tally
      .map(([reason, amount, multiplier]) => amount * multiplier)
      .reduce((a, b) => a + b));

    const table = new Table([{}, { align: 'right' }]);

    for (const [reason, amount] of this.tally) {
      table.rows.push([reason, formatMoney(amount)]);
    }

    table.rows.push(['Unaccounted for', formatMoney(remainder)]);

    this.console?.printInfo('Totals', 'Transaction amount flow:');
    for (const row of table.eachRow()) {
      this.console?.printInfo('Totals', '  ' + row);
    }
  }

}
