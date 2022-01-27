import { Table } from "../log/table";
import { Deal } from "../model/deal";
import { formatMoney, formatNumber } from "../util/formatters";
import { isPresent } from "../util/helpers";
import { Engine } from "./engine";

export function printSummary(engine: Engine) {

  if (engine.dealManager.duplicates.size > 0) {
    Table.print({
      title: 'Duplicate Deals',
      log: s => engine.log?.consoleLogger.printWarning('Dups', s),
      cols: [
        [{ title: 'Primary' }, s => s[0].link()],
        [{ title: 'Duplicate(s)' }, s => s[1].map(d => d.link())],
      ],
      rows: engine.dealManager.duplicates,
    });

    const dupTotal = ([...engine.dealManager.duplicates]
      .flatMap(([primary, dups]) => dups)
      .map((dup) => dup.data.amount ?? 0)
      .reduce((a, b) => a + b));

    engine.log?.consoleLogger.printWarning('Deal Generator', 'Total of duplicates:', formatMoney(dupTotal));
    engine.log?.consoleLogger.printWarning('Deal Generator', 'Total duplicates:', engine.dealManager.duplicates.size);

    engine.tallier.less('Over-accounted: Duplicate deals', -dupTotal);
  }

  const deals = engine.dealManager.getArray();

  const table = new Table([{}, { align: 'right' }]);

  table.rows.push(['# Total Deals', formatNumber(deals.length)]);
  table.rows.push(['$ Total Deals', formatMoney(sumDeals(deals))]);
  table.rows.push(['$ Total Deals Won', formatMoney(sumDeals(deals.filter(d => d.isWon)))]);
  table.rows.push(['$ Total Deals Lost', formatMoney(sumDeals(deals.filter(d => d.isLost)))]);
  table.rows.push(['$ Total Deals Eval', formatMoney(sumDeals(deals.filter(d => d.isEval())))]);

  engine.log?.consoleLogger.printInfo('Summary', 'Results of this run:');
  for (const row of table.eachRow()) {
    engine.log?.consoleLogger.printInfo('Summary', '  ' + row);
  }

  engine.tallier.less('Deal sum', sumDeals(deals));
  engine.tallier.printTable();
}

function sumDeals(deals: Deal[]) {
  return (deals
    .map(d => d.data.amount)
    .filter(isPresent)
    .reduce((a, b) => a + b, 0));
}
