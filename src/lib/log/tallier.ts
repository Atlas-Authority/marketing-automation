import { formatMoney } from "../util/formatters.js";
import log from "./logger.js";
import { Table } from "./table.js";

export class Tallier {

  private tally: [string, number, number][] = [];
  first(reason: string, n: number) { this.tally.push([reason, n, 1]); }
  less(reason: string, n: number) { this.tally.push([reason, n, -1]); }

  printTable() {
    const remainder = (this.tally
      .map(([reason, amount, multiplier]) => amount * multiplier)
      .reduce((a, b) => a + b));

    const table = new Table(2);

    for (const [reason, amount] of this.tally) {
      table.addRow([[reason], [formatMoney(amount), 'right']]);
    }

    table.addRow([['Unaccounted for'], [formatMoney(remainder), 'right']]);

    log.info('Totals', 'Transaction amount flow:');
    for (const row of table.eachRow()) {
      log.info('Totals', '  ' + row);
    }
  }

}
