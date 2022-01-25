import 'source-map-support/register';
import util from 'util';
import DataDir from '../lib/data/dir';
import { DataSet } from '../lib/data/set';
import { DealGenerator } from '../lib/engine/deal-generator/generate-deals';
import { abbrActionDetails, abbrEventDetails } from '../lib/engine/deal-generator/test/utils';
import { Engine } from "../lib/engine/engine";
import { RelatedLicenseSet } from '../lib/engine/license-matching/license-grouper';
import { Hubspot } from '../lib/hubspot';
import { License } from '../lib/marketplace/model/license';
import { Transaction } from '../lib/marketplace/model/transaction';
import { engineConfigFromENV } from '../lib/parameters/env-config';

function TEMPLATE({ runDealGenerator, GROUP, RECORDS, EVENTS, ACTIONS }: any) {
  it(`describe test`, () => {
    const { events, actions } = runDealGenerator({
      group: GROUP,
      deals: [],
      records: RECORDS,
    });
    expect(events).toEqual(EVENTS);
    expect(actions).toEqual(ACTIONS);
  });
}

function main(template: string, testId: string) {
  const json = Buffer.from(testId, 'base64').toString('utf8');
  const ids: [string, string[]][] = JSON.parse(json);

  const group = getRedactedMatchGroup(ids);

  const engine = new Engine(null, Hubspot.memory(null), null);

  engine.licenses.length = 0;
  engine.licenses.push(...group);

  engine.transactions.length = 0;
  engine.transactions.push(...group.flatMap(g => g.transactions));

  const dealGenerator = new DealGenerator(null, engine);
  const { records, events, actions } = dealGenerator.generateActionsForMatchedGroup(group);

  console.log(template
    .replace('GROUP', format(ids, 100))
    .replace('RECORDS', `[\n${records.map(abbrRecordDetails).join(',\n')}\n]`)
    .replace('EVENTS', `[\n${events.map(event => format(abbrEventDetails(event), Infinity)).join(',\n')}\n]`)
    .replace('ACTIONS', format(actions.map(abbrActionDetails)))
  );
}

function format(o: any, breakLength = 50) {
  return util.inspect(o, { depth: null, breakLength });
}

function getRedactedMatchGroup(ids: [string, string[]][]) {
  const engine = new Engine(null, Hubspot.memory(null), engineConfigFromENV());
  const data = new DataSet(DataDir.root.subdir('in')).load();
  // engine.importData(data);

  const group: RelatedLicenseSet = [];
  for (const [lid, txids] of ids) {
    const license = engine.licenses.find(l => l.id === lid)!;
    group.push(license);
    for (const tid of txids) {
      const transaction = engine.transactions.find(t => t.id === tid)!;
      license.transactions.push(transaction);
      transaction.license = license;
    }
  }
  return group;
}

const template = (TEMPLATE
  .toString()
  .split(/\n/g)
  .slice(1, -1)
  .join('\n'));

const testId = process.argv.pop()!;

main(template, testId);

function abbrRecordDetails(record: License | Transaction) {
  if (record instanceof Transaction) {
    return `testTransaction(${[
      record.id,
      record.data.saleDate,
      record.data.licenseType,
      record.data.saleType,
      record.data.transactionId,
      record.data.vendorAmount,
    ]
      .map(s => JSON.stringify(s))
      .join(', ')})`;
  }
  else {
    return `testLicense(${[
      record.id,
      record.data.maintenanceStartDate,
      record.data.licenseType,
      record.data.status,
    ]
      .map(s => JSON.stringify(s))
      .join(', ')})`;
  }
}
