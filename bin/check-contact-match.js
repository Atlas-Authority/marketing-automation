import CachedFileDownloader from '../lib/downloader/cached-file-downloader.js';
import { downloadInitialData } from '../lib/downloader/download-initial-data.js';
import * as datadir from '../lib/util/datadir.js';
import * as logger from '../lib/util/logger.js';

const [contactId] = process.argv.slice(2);

if (!contactId) {
  console.log('Usage: node bin/check-licenses.js [--verbose] <SEN-L12345ABCDE>...');
  process.exit(1);
}

const data = await downloadInitialData({
  downloader: new CachedFileDownloader()
});

const contact = data.allContacts.find(c => c.hs_object_id === contactId);

logger.info('Dev', contact);

/** @type {ReturnType<import('../lib/engine/license-grouper.js').shorterLicenseInfo>[][]} */
const matchedGroups = datadir.readJsonFile('out', 'matched-groups-all.json');

const groups = matchedGroups.filter(g => g.some(l => l.tech_email === contact?.email));

/** @type {(keyof matchedGroups[0][0])[]} */
const keys = ['company', 'tech_email', 'tech_name', 'tech_address', 'tech_city', 'tech_phone', 'tech_state', 'tech_zip', 'tech_country'];

for (const group of groups) {
  const first = group[0];
  if (first) {
    for (const key of keys) {
      logger.info(key, '');
      for (const l of group) {
        logger.info(key, l[key]);
      }
    }
  }
}
