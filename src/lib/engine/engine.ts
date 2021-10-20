import { downloadAllData } from '../io/downloader/download-initial-data.js';
import { Downloader } from '../io/downloader/downloader.js';
import { Contact } from '../types/contact.js';
import { RelatedLicenseSet } from '../types/license.js';
import { Uploader } from '../io/uploader/uploader.js';
import log from '../log/logger.js';
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
  await findAndFlagExternallyCreatedContacts(db);

  logStep('Generating contacts');
  generateContacts(db);

  logStep('Flagging partner companies');
  await findAndFlagPartnerCompanies(db);

  logStep('Flagging partners by domain');
  findAndFlagPartnersByDomain({
    contacts: generatedContacts,
    sourceContacts: db.allContacts,
    providerDomains: db.providerDomains,
  });

  logStep('Upserting Contacts in Hubspot');
  db.contactManager.syncUpAllEntities();

  logStep('Updating Companies in Hubspot');
  db.companyManager.syncUpAllEntities();

  const contactsByEmail: { [email: string]: Contact } = buildContactsStructure(verifiedContacts);

  logStep('Running Scoring Engine');
  const allMatches: RelatedLicenseSet[] = matchIntoLikelyGroups({
    transactions: db.allTransactions,
    licenses: db.allLicenses,
    providerDomains: db.providerDomains,
    contactsByEmail,
  });

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
    partnerDomains,
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
