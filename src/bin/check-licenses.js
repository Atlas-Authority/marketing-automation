import CachedFileDownloader from '../lib/downloader/cached-file-downloader.js';
import { downloadAllData } from '../lib/downloader/download-initial-data.js';
import { buildContactsStructure } from '../lib/engine/contacts.js';
import { olderThan90Days } from '../lib/engine/generate-deals.js';
import * as datadir from '../lib/util/datadir.js';
import logger from '../lib/util/logger.js';

const args = process.argv.slice(2);

const verbose = (args[0] === '--verbose');
if (verbose) args.shift();

const sens = args;
if (sens.length === 0 || !sens.every(sen => sen.length > 0)) {
  console.log('Usage: node bin/check-licenses.js [--verbose] <SEN-L12345ABCDE>...');
  process.exit(1);
}

const data = await downloadAllData({
  downloader: new CachedFileDownloader()
});

const contactsByEmail = buildContactsStructure(data.allContacts);

/** @type {(License & {reason: string})[][]} */
const ignored = datadir.readJsonFile('out', 'ignored.json');

/** @type {ReturnType<import('../lib/engine/license-grouper.js').shorterLicenseInfo>[][]} */
const matchedGroups = datadir.readJsonFile('out', 'matched-groups-all.json');

for (const sen of sens) {
  check(sen);
}


/**
 * @param {string} sen
 */
function check(sen) {
  if (sen.startsWith('SEN-')) sen = sen.slice(4);

  const withWrongId = data.allLicenses.find(l => l.addonLicenseId !== sen && l.licenseId === 'SEN-' + sen);
  if (withWrongId) {
    logger.warn('Dev', sen, `Using addonLicenseId (${withWrongId.addonLicenseId}) instead of licenseId`);
    sen = withWrongId.addonLicenseId;
  }

  if (checkSEN(sen)) {
    return;
  }

  const foundMatch = matchedGroups.find(group => group.find(l => l.addonLicenseId === sen));
  if (foundMatch) {
    if (foundMatch.every(l => olderThan90Days(l.start))) {
      logger.info('Dev', sen, 'All matches > 90 days old');
      return;
    }

    const matches = foundMatch.filter(l => l.addonLicenseId !== sen);
    for (const otherLicense of matches) {
      logger.warn('Dev', sen, `Checking matched license ${otherLicense.addonLicenseId}`);

      if (checkSEN(otherLicense.addonLicenseId)) {
        return;
      }
    }
  }

  logger.error('Dev', sen, 'Status unsure');
}

/**
 * @param {string} sen
 */
function checkSEN(sen) {
  const foundDeal = data.allDeals.find(d => d.properties.addonlicenseid === sen);
  if (foundDeal) {
    logger.info('Dev', sen, 'Already has deal:', foundDeal.id);
    return true;
  }

  const foundIgnoreds = ignored.find(group => group.find(l => l.addonLicenseId === sen));
  if (foundIgnoreds) {
    logger.info('Dev', sen, 'Licenses were ignored:', foundIgnoreds[0].reason, verbose ? foundIgnoreds : '');
    return true;
  }

  const ls = data.allLicenses.filter(l => l.addonLicenseId === sen);
  const cs = ls.map(l => contactsByEmail[l.contactDetails.technicalContact.email]);
  if (cs.some(c => c.contact_type === 'Partner')) {
    logger.info('Dev', sen, 'Contact is Partner');
    return true;
  }

  return false;
}
