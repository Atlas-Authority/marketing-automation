import * as fs from 'fs';
import * as datadir from '../lib/cache/datadir.js';
import { olderThan90Days } from '../lib/engine/deal-generator/generate-deals.js';
import { shorterLicenseInfo } from '../lib/engine/license-matching/license-grouper.js';
import CachedFileDownloader from '../lib/io/downloader/cached-file-downloader.js';
import ConsoleUploader from '../lib/io/uploader/console-uploader.js';
import log from '../lib/log/logger.js';
import { Database } from '../lib/model/database.js';
import { License } from '../lib/types/license.js';
import { Transaction } from '../lib/types/transaction.js';

const args = process.argv.slice(2);

const verbose = (args[0] === '--verbose');
if (verbose) args.shift();

let sens = args;
if (sens.length === 0 || !sens.every(sen => sen.length > 0)) {
  console.log('Usage: node bin/check-licenses.js [--verbose] <SEN-L12345ABCDE>... | <transactions.json>');
  process.exit(1);
}

if (sens.length === 1 && sens[0].endsWith('.json')) {
  const ts: Transaction[] = JSON.parse(fs.readFileSync(sens[0], 'utf8'));
  sens = ts.map(t => t.addonLicenseId);
}

const db = new Database(new CachedFileDownloader(), new ConsoleUploader({ verbose: true }));
await db.downloadAllData();

const ignored: (License & { reason: string })[][] = datadir.readJsonFile('out', 'ignored.json');

const matchedGroups: ReturnType<typeof shorterLicenseInfo>[][] = datadir.readJsonFile('out', 'matched-groups-all.json');

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
    if (foundMatch.every(l => olderThan90Days(l.start))) {
      log.info('Dev', sen, 'All matches > 90 days old');
      return;
    }

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
