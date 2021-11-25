import { formatMoney } from "../util/formatters.js";
import log from "./logger.js";
import { Table } from "./table.js";

export class Tallier {

  private tally: [string, number, number][] = [];
  public first(reason: string, n: number) { this.tally.push([reason, n, 1]); }
  public less(reason: string, n: number) { this.tally.push([reason, n, -1]); }

  public printTable() {
    const remainder = (this.tally
      .map(([reason, amount, multiplier]) => amount * multiplier)
      .reduce((a, b) => a + b));

    const table = new Table([{}, { align: 'right' }]);

    for (const [reason, amount] of this.tally) {
      table.rows.push([reason, formatMoney(amount)]);
    }

    table.rows.push(['Unaccounted for', formatMoney(remainder)]);

    log.info('Totals', 'Transaction amount flow:');
    for (const row of table.eachRow()) {
      log.info('Totals', '  ' + row);
    }
  }

}
