import 'source-map-support/register';
import { identifyAndFlagContactTypes } from '../lib/engine/contacts/contact-types';
import { ContactGenerator } from '../lib/engine/contacts/generate-contacts';
import { abbrActionDetails } from '../lib/engine/deal-generator/actions';
import { abbrEventDetails } from '../lib/engine/deal-generator/events';
import { DealGenerator } from '../lib/engine/deal-generator/generate-deals';
import { redactedLicense, redactedTransaction } from '../lib/engine/deal-generator/redact';
import { matchIntoLikelyGroups, RelatedLicenseSet } from '../lib/engine/license-matching/license-grouper';
import { IO } from "../lib/io/io";
import { Database } from "../lib/model/database";

main(process.argv.pop()!);
async function main(licenseId: string) {

  const db = new Database(new IO({ in: 'local', out: 'local' }));
  await db.downloadAllData();
  identifyAndFlagContactTypes(db);
  new ContactGenerator(db).run();
  const allMatches = matchIntoLikelyGroups(db);

  const match = (allMatches
    .find(group =>
      group.some(g => g.license.id === licenseId))!
    .map(g => ({
      license: redactedLicense(g.license),
      transactions: g.transactions.map(redactedTransaction),
    }))
  );

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
