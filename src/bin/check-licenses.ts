import * as fs from 'fs';
import DataDir from '../lib/cache/datadir.js';
import { shorterLicenseInfo } from '../lib/engine/license-matching/license-grouper.js';
import { MemoryRemote } from '../lib/io/memory-remote.js';
import log from '../lib/log/logger.js';
import { Database } from '../lib/model/database.js';
import { LicenseData } from '../lib/model/license.js';
import { RawTransaction } from '../lib/model/marketplace/raw.js';

const args = process.argv.slice(2);

const verbose = (args[0] === '--verbose');
if (verbose) args.shift();

let sens = args;
if (sens.length === 0 || !sens.every(sen => sen.length > 0)) {
  console.log('Usage: node bin/check-licenses.js [--verbose] <SEN-L12345ABCDE>... | <transactions.json>');
  process.exit(1);
}

if (sens.length === 1 && sens[0].endsWith('.json')) {
  const ts: RawTransaction[] = JSON.parse(fs.readFileSync(sens[0], 'utf8'));
  sens = ts.map(t => t.addonLicenseId);
}

const memoryRemote = new MemoryRemote({ verbose: true });
const db = new Database(memoryRemote, memoryRemote);
await db.downloadAllData();

const ignored: (LicenseData & { reason: string })[][] = DataDir.out.readJsonFile('ignored.json');

const matchedGroups: ReturnType<typeof shorterLicenseInfo>[][] = DataDir.out.readJsonFile('matched-groups-all.json');

for (const sen of sens) {
  check(sen);
}


function check(sen: string) {
  if (sen.startsWith('SEN-')) sen = sen.slice(4);

  const withWrongId = db.licenses.find(l => l.data.addonLicenseId !== sen && l.data.licenseId === 'SEN-' + sen);
  if (withWrongId) {
    log.warn('Dev', sen, `Using addonLicenseId (${withWrongId.data.addonLicenseId}) instead of licenseId`);
    sen = withWrongId.data.addonLicenseId;
  }

  if (checkSEN(sen)) {
    return;
  }

  const foundMatch = matchedGroups.find(group => group.find(l => l.addonLicenseId === sen));
  if (foundMatch) {
    const matches = foundMatch.filter(l => l.addonLicenseId !== sen);
    for (const otherLicense of matches) {
      log.warn('Dev', sen, `Checking matched license ${otherLicense.addonLicenseId}`);

      if (checkSEN(otherLicense.addonLicenseId)) {
        return;
      }
    }
  }

  log.error('Dev', sen, 'Status unsure');
}

function checkSEN(sen: string) {
  const foundDeal = db.dealManager.getByAddonLicenseId(sen);
  if (foundDeal) {
    log.info('Dev', sen, 'Already has deal:', foundDeal.id);
    return true;
  }

  const foundIgnoreds = ignored.find(group => group.find(l => l.addonLicenseId === sen));
  if (foundIgnoreds) {
    log.info('Dev', sen, 'Licenses were ignored:', foundIgnoreds[0].reason, verbose ? foundIgnoreds : '');
    return true;
  }

  const ls = db.licenses.filter(l => l.data.addonLicenseId === sen);
  const cs = ls.map(l => db.contactManager.getByEmail(l.data.technicalContact.email));
  if (cs.some(c => c && c.data.contactType === 'Partner')) {
    log.info('Dev', sen, 'Contact is Partner');
    return true;
  }

  return false;
}
