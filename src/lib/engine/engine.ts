import { downloadAllData } from '../downloader/download-initial-data.js';
import { Downloader } from '../downloader/downloader.js';
import { Contact } from '../types/contact.js';
import { RelatedLicenseSet } from '../types/license.js';
import { Uploader } from '../uploader/uploader.js';
import log from '../log/logger.js';
import { buildContactsStructure } from './contacts.js';
import { generateContactUpdateActions } from './generate-contact-updates.js';
import { generateContacts } from "./generate-contacts.js";
import { generateDeals } from './generate-deals.js';
import { matchIntoLikelyGroups } from './license-grouper.js';
import { findAndFlagExternallyCreatedContacts, findAndFlagPartnerCompanies, findAndFlagPartnersByDomain, identifyDomains } from './partners.js';
import { updateContactsInHubspotAgain } from './upsert-contact-updates.js';
import { upsertContactsInHubspot } from "./upsert-contacts.js";
import { upsertDealsInHubspot } from './upsert-deals.js';
import zeroEmptyDealAmounts from './zero-empty-deal-amounts.js';

export default async function runEngine({ downloader, uploader }: {
  downloader: Downloader,
  uploader: Uploader,
}) {
  resetLogCount();

  logStep('Starting to download data');
  const initialData = await downloadAllData({
    downloader,
  });

  logStep('Normalizing deal amounts');
  await zeroEmptyDealAmounts({ deals: initialData.allDeals, uploader });

  logStep('Identifying partner and customer domains');
  const { partnerDomains, customerDomains } = identifyDomains({
    licenses: initialData.allLicenses,
    transactions: initialData.allTransactions,
  });

  logStep('Flagging partner/customer contacts created outside engine');
  await findAndFlagExternallyCreatedContacts({
    contacts: initialData.allContacts,
    partnerDomains,
    customerDomains,
    uploader,
  });

  logStep('Generating contacts');
  const generatedContacts = generateContacts({
    licenses: initialData.allLicenses,
    transactions: initialData.allTransactions,
    initialContacts: initialData.allContacts,
    partnerDomains,
  });

  logStep('Flagging partner companies');
  await findAndFlagPartnerCompanies({
    contacts: generatedContacts,
    companies: initialData.allCompanies,
    uploader,
  });

  logStep('Flagging partners by domain');
  findAndFlagPartnersByDomain({
    contacts: generatedContacts,
    sourceContacts: initialData.allContacts,
    providerDomains: initialData.providerDomains,
  });

  logStep('Upserting contacts in Hubspot');
  const verifiedContacts = await upsertContactsInHubspot({
    uploader,
    newContacts: generatedContacts,
    oldContacts: initialData.allContacts,
  });

  const contactsByEmail: { [email: string]: Contact } = buildContactsStructure(verifiedContacts);

  logStep('Running Scoring Engine');
  const allMatches: RelatedLicenseSet[] = matchIntoLikelyGroups({
    transactions: initialData.allTransactions,
    licenses: initialData.allLicenses,
    providerDomains: initialData.providerDomains,
    contactsByEmail,
  });

  logStep('Generating contact updates');
  const contactUpdateActions = generateContactUpdateActions(allMatches, contactsByEmail);

  logStep('Updating contacts in Hubspot');
  await updateContactsInHubspotAgain({ uploader, contactUpdateActions });

  logStep('Generating deals');
  const dealDiffs = generateDeals({
    contactsByEmail,
    initialDeals: initialData.allDeals,
    providerDomains: initialData.providerDomains,
    allMatches,
    partnerDomains,
  });

  logStep('Upserting deals in Hubspot');
  await upsertDealsInHubspot({
    uploader,
    dealDiffs,
    contacts: verifiedContacts,
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
