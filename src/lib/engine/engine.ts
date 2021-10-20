import { downloadAllData } from '../io/downloader/download-initial-data.js';
import { Downloader } from '../io/downloader/downloader.js';
import { Uploader } from '../io/uploader/uploader.js';
import log from '../log/logger.js';
import { Contact } from '../types/contact.js';
import { buildContactsStructure } from './contacts.js';
import { generateContactUpdateActions } from './generate-contact-updates.js';
import { generateContacts } from "./generate-contacts.js";
import { backfillDealCompanies, generateDeals } from './generate-deals.js';
import { matchIntoLikelyGroups } from './license-grouper.js';
import { findAndFlagExternallyCreatedContacts, findAndFlagPartnerCompanies, findAndFlagPartnersByDomain, identifyDomains } from './partners.js';
import { updateContactsInHubspotAgain } from './upsert-contact-updates.js';
import { upsertDealsInHubspot } from './upsert-deals.js';
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
  const externalContacts = generateContacts(db);

  logStep('Removing externally created contacts from rest of engine run');
  db.contactManager.removeExternallyCreatedContacts(externalContacts);

  logStep('Flagging partner companies');
  findAndFlagPartnerCompanies(db);

  logStep('Flagging partners by domain');
  findAndFlagPartnersByDomain(db);

  logStep('Upserting Contacts in Hubspot');
  await db.contactManager.syncUpAllEntities();

  logStep('Updating Companies in Hubspot');
  await db.companyManager.syncUpAllEntities();

  const verifiedContacts: Contact[] = [];
  const contactsByEmail: { [email: string]: Contact } = buildContactsStructure(verifiedContacts);

  logStep('Running Scoring Engine');
  const allMatches = matchIntoLikelyGroups(db);

  logStep('Generating contact updates');
  const contactUpdateActions = generateContactUpdateActions(allMatches, contactsByEmail);

  logStep('Updating contacts in Hubspot');
  await updateContactsInHubspotAgain({ uploader, contactUpdateActions });

  logStep('Backfill deal companies');
  await backfillDealCompanies({
    allMatches,
    deals: db.allDeals,
    contacts: verifiedContacts,
    uploader,
  });

  logStep('Generating deals');
  const dealDiffs = generateDeals({
    contactsByEmail,
    initialDeals: db.allDeals,
    providerDomains: db.providerDomains,
    allMatches,
    partnerDomains: db.partnerDomains,
  });

  logStep('Upserting deals in Hubspot');
  await upsertDealsInHubspot({
    uploader,
    dealDiffs,
  });

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
