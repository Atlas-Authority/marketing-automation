import 'source-map-support/register';
import { RelatedLicenseSet } from '../lib/engine/license-matching/license-grouper';
import { IO } from "../lib/io/io";
import { Database } from "../lib/model/database";

main(process.argv[2]);
async function main(testId: string) {

  const json = Buffer.from(testId, 'base64').toString('utf8');
  const ids: [string, string[]][] = JSON.parse(json);

  const db = new Database(new IO({ in: 'local', out: 'local' }));
  await db.downloadAllData();

  const group: RelatedLicenseSet = ids.map(([licenseId, transactionIds]) => {
    return {
      license: db.licenses.find(l => l.id === licenseId)!,
      transactions: transactionIds.map(id =>
        db.transactions.find(t => t.id === id)!)
    }
  });

  console.dir(group, { depth: null });

}
