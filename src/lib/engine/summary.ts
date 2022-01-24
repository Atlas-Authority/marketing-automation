import { Deal } from "../hubspot/model/deal";
import log from "../log/logger";
import { Table } from "../log/table";
import { formatMoney, formatNumber } from "../util/formatters";
import { isPresent } from "../util/helpers";
import { Engine } from "./engine";

export function printSummary(engine: Engine) {

  if (engine.dealManager.duplicates.size > 0) {
    Table.print({
      title: 'Duplicate Deals',
      log: s => log.warn('Dups', s),
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

    log.warn('Deal Generator', 'Total of duplicates:', formatMoney(dupTotal));
    log.warn('Deal Generator', 'Total duplicates:', engine.dealManager.duplicates.size);

    engine.tallier.less('Over-accounted: Duplicate deals', -dupTotal);
  }

  const dealChanges = engine.dealManager.getPrintableChanges();
  const contactChanges = engine.contactManager.getPrintableChanges();
  const companyChanges = engine.companyManager.getPrintableChanges();

  log.verbose('Summary', 'Deals Created', dealChanges.created);
  log.verbose('Summary', 'Deals Updated', dealChanges.updated);
  log.verbose('Summary', 'Deal Associations to Create', dealChanges.associationsToCreate);
  log.verbose('Summary', 'Deal Associations to Delete', dealChanges.associationsToDelete);

  log.verbose('Summary', 'Contacts Created', contactChanges.created);
  log.verbose('Summary', 'Contacts Updated', contactChanges.updated);
  log.verbose('Summary', 'Contact Associations to Create', contactChanges.associationsToCreate);
  log.verbose('Summary', 'Contact Associations to Delete', contactChanges.associationsToDelete);

  log.verbose('Summary', 'Companies Updated', companyChanges.updated);

  const deals = engine.dealManager.getArray();

  const table = new Table([{}, { align: 'right' }]);

  table.rows.push(['# Total Deals', formatNumber(deals.length)]);
  table.rows.push(['$ Total Deals', formatMoney(sumDeals(deals))]);
  table.rows.push(['$ Total Deals Won', formatMoney(sumDeals(deals.filter(d => d.isWon)))]);
  table.rows.push(['$ Total Deals Lost', formatMoney(sumDeals(deals.filter(d => d.isLost)))]);
  table.rows.push(['$ Total Deals Eval', formatMoney(sumDeals(deals.filter(d => d.isEval())))]);

  table.rows.push(['Deals Created', formatNumber(dealChanges.created.length)]);
  table.rows.push(['Deals Updated', formatNumber(dealChanges.updated.length)]);
  table.rows.push(['Deals Associated', formatNumber(dealChanges.associationsToCreate.length)]);
  table.rows.push(['Deals DisAssociated', formatNumber(dealChanges.associationsToDelete.length)]);

  table.rows.push(['Contacts Created', formatNumber(contactChanges.created.length)]);
  table.rows.push(['Contacts Updated', formatNumber(contactChanges.updated.length)]);
  table.rows.push(['Contacts Associated', formatNumber(contactChanges.associationsToCreate.length)]);
  table.rows.push(['Contacts Disassociated', formatNumber(contactChanges.associationsToDelete.length)]);

  table.rows.push(['Companies Updated', formatNumber(companyChanges.updated.length)]);

  log.info('Summary', 'Results of this run:');
  for (const row of table.eachRow()) {
    log.info('Summary', '  ' + row);
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
