import 'source-map-support/register';
import util from 'util';
import { abbrEventDetails } from '../lib/engine/deal-generator/events';
import { DealGenerator } from '../lib/engine/deal-generator/generate-deals';
import { redactedLicense, redactedTransaction } from '../lib/engine/deal-generator/redact';
import { abbrActionDetails } from '../lib/engine/deal-generator/test/utils';
import { LicenseContext, RelatedLicenseSet } from '../lib/engine/license-matching/license-grouper';
import { IO } from "../lib/io/io";
import { Database } from "../lib/model/database";

function TEMPLATE({ runDealGenerator, MATCH_GROUP, EVENTS, ACTIONS }: any) {
  it(`describe test`, () => {
    const { events, actions } = runDealGenerator({
      deals: [],
      matchGroup: MATCH_GROUP
    });
    expect(events).toEqual(EVENTS);
    expect(actions).toEqual(ACTIONS);
  });
}

async function main(template: string, testId: string) {
  console.log("Using template:\n", template);

  const json = Buffer.from(testId, 'base64').toString('utf8');
  const ids: [string, string[]][] = JSON.parse(json);
  const match = await getRedactedMatchGroup(ids);

  const db = new Database(new IO());

  db.licenses.length = 0;
  db.licenses.push(...match.map(g => g.license));

  db.transactions.length = 0;
  db.transactions.push(...match.flatMap(g => g.transactions));

  const matchGroup = match.map(g => ({
    license: g.license.data,
    transactions: g.transactions.map(t => t.data),
  }));

  const dealGenerator = new DealGenerator(db);
  const { events, actions } = dealGenerator.generateActionsForMatchedGroup(match);

  const format = (o: any) => util.inspect(o, { depth: null, breakLength: 50 });

  console.log(template
    .replace('MATCH_GROUP', format(matchGroup))
    .replace('EVENTS', format(events.map(abbrEventDetails)))
    .replace('ACTIONS', format(actions.map(abbrActionDetails)))
  );
}

async function getRedactedMatchGroup(ids: [string, string[]][]): Promise<RelatedLicenseSet> {
  const db = new Database(new IO({ in: 'local', out: 'local' }));
  await db.downloadAllData();

  const group: RelatedLicenseSet = [];
  for (const [lid, txids] of ids) {
    const license = redactedLicense(db.licenses.find(l => l.id === lid)!);
    const context: LicenseContext = { license, transactions: [] };
    for (const tid of txids) {
      const transaction = redactedTransaction(db.transactions.find(t => t.id === tid)!);
      context.transactions.push(transaction);
    }
    group.push(context);
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
