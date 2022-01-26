import 'source-map-support/register';
import util from 'util';
import DataDir from '../lib/data/dir';
import { DataSet } from '../lib/data/set';
import { abbrActionDetails, abbrEventDetails } from '../../tests/deal-generator/utils';
import { Engine } from "../lib/engine/engine";
import { Hubspot } from '../lib/hubspot';
import { Logger } from '../lib/log';
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

function main(template: string, licenseIds: string[]) {
  const engine = new Engine(Hubspot.memory(), engineConfigFromENV(), new Logger());
  const data = new DataSet(DataDir.root.subdir('in')).load();
  const { dealGeneratorResults } = engine.run(data);

  for (const licenseId of licenseIds) {
    const results = dealGeneratorResults.get(licenseId);
    if (results) {
      const { actions, records, events } = results;
      console.log(template
        // .replace('GROUP', format(ids, 100))
        .replace('RECORDS', `[\n${records.map(abbrRecordDetails).join(',\n')}\n]`)
        .replace('EVENTS', `[\n${events.map(event => format(abbrEventDetails(event), Infinity)).join(',\n')}\n]`)
        .replace('ACTIONS', format(actions.map(abbrActionDetails)))
      );
    }
    else {
      console.log(`Can't find results for ${licenseId}`);
    }
  }
}

function format(o: any, breakLength = 50) {
  return util.inspect(o, { depth: null, breakLength });
}

const template = (TEMPLATE
  .toString()
  .split(/\n/g)
  .slice(1, -1)
  .join('\n'));

main(template, process.argv.slice(2));

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
