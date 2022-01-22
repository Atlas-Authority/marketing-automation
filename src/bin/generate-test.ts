import 'source-map-support/register';
import util from 'util';
import DataDir from '../lib/data/dir';
import { DataSet } from '../lib/data/set';
import { DealGenerator } from '../lib/engine/deal-generator/generate-deals';
import { abbrActionDetails, abbrEventDetails } from '../lib/engine/deal-generator/test/utils';
import { RelatedLicenseSet } from '../lib/engine/license-matching/license-grouper';
import { Database } from "../lib/model/database";
import { License } from '../lib/model/license';
import { Transaction } from '../lib/model/transaction';
import { envConfig } from '../lib/parameters/env-config';

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

async function main(template: string, testId: string) {
  const json = Buffer.from(testId, 'base64').toString('utf8');
  const ids: [string, string[]][] = JSON.parse(json);

  const group = await getRedactedMatchGroup(ids);

  const db = new Database(null, null);

  db.licenses.length = 0;
  db.licenses.push(...group);

  db.transactions.length = 0;
  db.transactions.push(...group.flatMap(g => g.transactions));

  const dealGenerator = new DealGenerator(db);
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

async function getRedactedMatchGroup(ids: [string, string[]][]) {
  const db = new Database(null, envConfig);
  const data = new DataSet(DataDir.root.subdir('in')).load();
  db.importData(data);

  const group: RelatedLicenseSet = [];
  for (const [lid, txids] of ids) {
    const license = db.licenses.find(l => l.id === lid)!;
    group.push(license);
    for (const tid of txids) {
      const transaction = db.transactions.find(t => t.id === tid)!;
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
