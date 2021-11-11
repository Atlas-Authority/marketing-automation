import { formatMoney } from "../util/formatters.js";
import log from "./logger.js";

export class Tallier {

  private tally: [string, number, number][] = [];
  first(reason: string, n: number) { this.tally.push([reason, n, 1]); }
  less(reason: string, n: number) { this.tally.push([reason, n, -1]); }

  printTable() {
    const remainder = (this.tally
      .map(([reason, amount, multiplier]) => amount * multiplier)
      .reduce((a, b) => a + b));

    const rows = [...this.tally];
    rows.push(['Unaccounted for', remainder, 0]);

    const widest = Math.max(...rows.map(([reason,]) => reason.length));

    log.info('Totals', 'Transaction amount flow', '\n' + rows.map(([reason, amount]) =>
      `  ${reason.padEnd(widest, ' ')}\t${formatMoney(amount)}`).join('\n'));
  }

}
