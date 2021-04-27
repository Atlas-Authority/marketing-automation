import _ from 'lodash';
import config from '../util/config.js';
import { isPresent } from '../util/helpers.js';

/**
 * @param {object} data
 * @param {License[]} data.licenses
 * @param {Transaction[]} data.transactions
 */
export function getPartnerDomains(data) {
  return new Set([
    ...identifyPartnerDomains([...data.licenses, ...data.transactions]),
    ...config.engine.partnerDomains,
  ]);
}

/**
 * @param {object} data
 * @param {Uploader} data.uploader
 * @param {Contact[]} data.contacts
 * @param {Set<string>} data.partnerDomains
 */
export async function findAndFlagExternallyCreatedPartners({ uploader, contacts, partnerDomains }) {
  const found = contacts.filter(c =>
    c.contact_type === null &&
    c.email &&
    partnerDomains.has(c.email.split('@')[1])
  );

  for (const c of found) {
    c.contact_type = 'Partner';
  }

  await uploader.updateAllContacts(found.map(c => ({
    id: c.hs_object_id,
    properties: { contact_type: c.contact_type },
  })));
}

/**
 * @param {object} data
 * @param {Uploader} data.uploader
 * @param {GeneratedContact[]} data.contacts
 * @param {Company[]} data.companies
 */
export async function findAndFlagPartnerCompanies({ uploader, contacts, companies }) {
  /** @type {{ id: string, properties: { [key: string]: string } }[]} */
  const companyUpdates = [];

  for (const company of companies) {
    const members = contacts.filter(contact => contact.company_id === company.id);
    const hasPartner = members.some(c => c.contact_type === 'Partner');

    if (hasPartner) {
      if (company.type !== 'PARTNER') {
        company.type = 'PARTNER';
        companyUpdates.push({
          id: company.id,
          properties: { type: company.type }
        });
      }

      for (const member of members.filter(c => c.contact_type !== 'Partner')) {
        member.contact_type = 'Partner';
      }
    }
  }

  await uploader.updateAllCompanies(companyUpdates);
}

/**
 * @param {object} data
 * @param {GeneratedContact[]} data.contacts
 * @param {Contact[]} data.sourceContacts
 * @param {Set<string>} data.providerDomains
 */
export function findAndFlagPartnersByDomain({ contacts, sourceContacts, providerDomains }) {
  /** @type {Map<string, Contact[]>} */
  const domainToContacts = new Map();

  for (const sc of sourceContacts) {
    if (!sc.email || !sc.contact_type) continue;
    const domain = sc.email.split('@')[1];
    if (!domainToContacts.has(domain)) domainToContacts.set(domain, []);
    domainToContacts.get(domain)?.push(sc);
  }

  for (const domain of providerDomains) {
    domainToContacts.delete(domain);
  }

  const partnerDomains = new Set([...domainToContacts]
    .filter(([, contacts]) =>
      contacts.some(c => c.contact_type === 'Partner'))
    .map(([domain,]) => domain));

  for (const contact of contacts) {
    const domain = contact.email.split('@')[1];
    if (partnerDomains.has(domain) && contact.contact_type === 'Customer') {
      contact.contact_type = 'Partner';
    }
  }
}

/**
 * @param {Array<License | Transaction>} items
 */
function identifyPartnerDomains(items) {
  return _.uniq(items
    .map(thing => thing.partnerDetails?.billingContact.email)
    .filter(isPresent)
    .map(email => email.split('@')[1]));
}
