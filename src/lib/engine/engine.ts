import { downloadAllData } from '../io/downloader/download-initial-data.js';
import { Downloader } from '../io/downloader/downloader.js';
import { Uploader } from '../io/uploader/uploader.js';
import log from '../log/logger.js';
import { backfillDealCompanies } from './backfill-deal-companies.js';
import { generateContacts } from "./generate-contacts.js";
import { generateDeals } from './generate-deals.js';
import { matchIntoLikelyGroups } from './license-grouper.js';
import { findAndFlagExternallyCreatedContacts, findAndFlagPartnerCompanies, findAndFlagPartnersByDomain, identifyDomains } from './partners.js';
import { updateContactsBasedOnMatchResults } from './update-contacts-using-matches.js';
import zeroEmptyDealAmounts from './zero-empty-deal-amounts.js';

export default async function runEngine({ downloader, uploader }: {
  downloader: Downloader,
  uploader: Uploader,
}) {
  resetLogCount();

  logStep('Starting to download data');
  const db = await downloadAllData({
    downloader,
  });

  logStep('Normalizing deal amounts');
  await zeroEmptyDealAmounts(db.dealManager);

  logStep('Identifying partner and customer domains');
  identifyDomains(db);

  logStep('Flagging partner/customer contacts created outside engine');
  findAndFlagExternallyCreatedContacts(db);
  await db.contactManager.syncUpAllEntities();

  logStep('Generating contacts');
  generateContacts(db);

  logStep('Removing externally created contacts from rest of engine run');
  db.contactManager.removeExternallyCreatedContacts();

  logStep('Flagging partner companies');
  findAndFlagPartnerCompanies(db);

  logStep('Flagging partners by domain');
  findAndFlagPartnersByDomain(db);

  logStep('Upserting Contacts in Hubspot');
  await db.contactManager.syncUpAllEntities();

  logStep('Updating Companies in Hubspot');
  await db.companyManager.syncUpAllEntities();

  logStep('Running Scoring Engine');
  const allMatches = matchIntoLikelyGroups(db);

  logStep('Updating Contacts based on Match Results');
  updateContactsBasedOnMatchResults(db, allMatches);
  await db.contactManager.syncUpAllEntities();

  logStep('Backfill deal companies');
  backfillDealCompanies(db, allMatches);
  await db.dealManager.syncUpAllEntities();

  logStep('Generating deals');
  generateDeals(db, allMatches);

  logStep('Upserting deals in Hubspot');
  await db.dealManager.syncUpAllEntities();

  logStep('Done!');
}

const PREFIX = '\x1b[36m'; // light blue
const RESET = '\x1b[0m';
let step = 0;

function logStep(description: string) {
  log.info('Marketing Automation', `${PREFIX}Step ${++step}: ${description}${RESET}`);
}

function resetLogCount() {
  step = 0;
}
