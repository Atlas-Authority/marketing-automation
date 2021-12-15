import {MemoryHubspot} from "../../io/memory/hubspot";
import {pathToFileURL, URL} from "url";
import {DealManager} from "../../model/deal";
import {DealRelevantEvent, EventGenerator} from "./events";
import {Action, ActionGenerator} from "./actions";
import {RelatedLicenseSet} from "../license-matching/license-grouper";
import {License, LicenseData} from "../../model/license";
import DataDir from "../../cache/datadir";
import {Transaction, TransactionData} from "../../model/transaction";
import * as fs from 'fs';
import {actionStringifyReplacer} from "./logger";

type RecordJson = {
  transactions: { data: TransactionData }[],
  license: { data: LicenseData },
}[]

const testDataDir = new URL('../../../test-data/', pathToFileURL(__dirname));

const scenarios = fs.readdirSync(testDataDir)
  .map(scenario => ({scenario, path: new URL(scenario + '/', testDataDir)}))
  .filter(testcaseInfo => fs.statSync(testcaseInfo.path).isDirectory())
  .map(({ scenario, path }) => {
    const desc = fs.readFileSync(new URL('desc.txt', path), 'utf8');
    const [ scenarioName, scenarioDesc ] = desc.split('\n');
    return { scenario, scenarioName, scenarioDesc };
  });

const getTestData = <T>(scenario: string, fileName: string): T => {
  return new DataDir(scenario, testDataDir).file<T>(fileName).readJson();
}

describe('Test deal generation', () => {
  test.each(scenarios)('$scenarioName: $scenarioDesc', async ({scenario}) => {
    const hubspotService = new MemoryHubspot(testDataDir, scenario);
    const dealManager = new DealManager(hubspotService, hubspotService);
    await dealManager.downloadAllEntities({setCount() {}, tick() {}});

    const recordJson = getTestData<RecordJson>(scenario, 'record.json');
    const records: RelatedLicenseSet = recordJson.map(json => {
      const { transactions, license } = json;
      return {
        license: new License(license.data),
        transactions: transactions.map(tx => new Transaction(tx.data)),
      };
    });

    const events = new EventGenerator().interpretAsEvents(records);
    const expectedEvents = getTestData<DealRelevantEvent[]>(scenario, 'event.json');
    expect(events).toEqual(expectedEvents);

    const actions = new ActionGenerator(dealManager).generateFrom(events);
    const expectedActions = getTestData<Action[]>(scenario, 'action.json');
    expect(JSON.parse(JSON.stringify(actions, actionStringifyReplacer))).toEqual(expectedActions);
    //console.log(JSON.stringify(actions, actionStringifyReplacer, 2));
  });
});
