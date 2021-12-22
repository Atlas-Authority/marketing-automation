import 'source-map-support/register';
import { abbrActionDetails } from '../lib/engine/deal-generator/actions';
import { abbrEventDetails } from '../lib/engine/deal-generator/events';
import { DealGenerator } from '../lib/engine/deal-generator/generate-deals';
import { redactedLicense, redactedTransaction } from '../lib/engine/deal-generator/redact';
import { LicenseContext, RelatedLicenseSet } from '../lib/engine/license-matching/license-grouper';
import { IO } from "../lib/io/io";
import { Database } from "../lib/model/database";

main(process.argv.pop()!);
async function main(testId: string) {

  const json = Buffer.from(testId, 'base64').toString('utf8');
  const ids: [string, string[]][] = JSON.parse(json);
  const match = await getRedactedMatchGroup(ids);

  const db = new Database(new IO({ in: 'local', out: 'local' }));
  await db.downloadAllData();

  db.licenses.length = 0;
  db.licenses.push(...match.map(g => g.license));

  db.transactions.length = 0;
  db.transactions.push(...match.flatMap(g => g.transactions));

  console.log('Input:');

  console.dir(match.map(g => ({
    license: g.license.data,
    transactions: g.transactions.map(t => t.data),
  })), { depth: null });

  console.log('Output:');

  const dealGenerator = new DealGenerator(db);

  const { events, actions } = dealGenerator.generateActionsForMatchedGroup(match);

  console.dir(events.map(abbrEventDetails), { depth: null });
  console.dir(actions.map(abbrActionDetails), { depth: null });

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
      transaction.context = context;
      transaction.matches = group;
      context.transactions.push(transaction);
    }
    license.context = context;
    license.matches = group;
    group.push(context);
  }
  return group;
}
