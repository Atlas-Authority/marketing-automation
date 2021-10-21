import * as datadir from '../lib/cache/datadir.js';
import { shorterLicenseInfo } from '../lib/engine/license-matching/license-grouper.js';
import CachedFileDownloader from '../lib/io/downloader/cached-file-downloader.js';
import ConsoleUploader from '../lib/io/uploader/console-uploader.js';
import log from '../lib/log/logger.js';
import { Database } from '../lib/model/database.js';

const [contactId] = process.argv.slice(2);

if (!contactId) {
  console.log('Usage: node bin/check-licenses.js [--verbose] <SEN-L12345ABCDE>...');
  process.exit(1);
}

const db = new Database(new CachedFileDownloader(), new ConsoleUploader({ verbose: true }));
await db.downloadAllData();

const contact = db.contactManager.get(contactId);

log.info('Dev', contact);

const matchedGroups: ReturnType<typeof shorterLicenseInfo>[][] = datadir.readJsonFile('out', 'matched-groups-all.json');

const groups = matchedGroups.filter(g => g.some(l => l.tech_email === contact?.data.email));

const keys: (keyof typeof matchedGroups[0][0])[] = ['company', 'tech_email', 'tech_name', 'tech_address', 'tech_city', 'tech_phone', 'tech_state', 'tech_zip', 'tech_country'];

for (const group of groups) {
  const first = group[0];
  if (first) {
    for (const key of keys) {
      log.info(key, '');
      for (const l of group) {
        log.info(key, l[key]);
      }
    }
  }
}
