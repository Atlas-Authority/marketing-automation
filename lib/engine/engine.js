import { downloadInitialData } from '../downloader/download-initial-data.js';
import * as logger from '../util/logger.js';
import { buildContactsStructure } from './contacts.js';
import { generateContactUpdateActions } from './generate-contact-updates.js';
import { generateContacts } from "./generate-contacts.js";
import { generateDeals } from './generate-deals.js';
import { matchIntoLikelyGroups } from './license-grouper.js';
import { findAndFlagExternallyCreatedPartners, findAndFlagPartnerCompanies, findAndFlagPartnersByDomain, identifyDomains } from './partners.js';
import { updateContactsInHubspotAgain } from './upsert-contact-updates.js';
import { upsertContactsInHubspot } from "./upsert-contacts.js";
import { upsertDealsInHubspot } from './upsert-deals.js';

/**
 * @param {object} options
 * @param {Downloader} options.downloader
 * @param {Uploader} options.uploader
 */
export default async function runEngine({ downloader, uploader }) {

  logStep('Starting to download data');
  const initialData = await downloadInitialData({
    downloader,
  });

  logStep('Identifying partner domains');
  const { partnerDomains } = identifyDomains({
    licenses: initialData.allLicenses,
    transactions: initialData.allTransactions,
  });

  logStep('Flagging partner contacts created outside engine');
  await findAndFlagExternallyCreatedPartners({
    contacts: initialData.allContacts,
    partnerDomains,
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

  /** @type {{ [email: string]: Contact }} */
  const contactsByEmail = buildContactsStructure(verifiedContacts);

  logStep('Running Scoring Engine');
  /** @type {RelatedLicenseSet[]} */
  const allMatches = matchIntoLikelyGroups({
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
  });

  logStep('Upserting deals in Hubspot');
  await upsertDealsInHubspot({ uploader, dealDiffs });

  logStep('Done!');
}

const PREFIX = '\x1b[36m'; // light blue
const RESET = '\x1b[0m';
let step = 0;

/**
 * @param {string} description
 */
function logStep(description) {
  logger.info('Marketing Automation', `${PREFIX}Step ${++step}: ${description}${RESET}`);
}
