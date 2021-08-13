import config from '../util/config.js';

/**
 * @param {object} data
 * @param {License[]} data.licenses
 * @param {Transaction[]} data.transactions
 */
export function identifyDomains(data) {
  const partnerDomains = new Set();
  const customerDomains = new Set();

  for (const l of data.licenses) {
    maybeAddDomain(partnerDomains, l.partnerDetails?.billingContact.email);
    maybeAddDomain(customerDomains, l.contactDetails.billingContact?.email);
  }

  for (const tx of data.transactions) {
    maybeAddDomain(partnerDomains, tx.partnerDetails?.billingContact.email);
    maybeAddDomain(customerDomains, tx.customerDetails.billingContact?.email);
    maybeAddDomain(customerDomains, tx.customerDetails.technicalContact.email);
  }

  for (const domain of config.engine.partnerDomains) {
    partnerDomains.add(domain);
  }

  for (const domain of customerDomains) {
    partnerDomains.delete(domain);
  }

  return {
    partnerDomains,
    customerDomains,
  };
}

/**
 * @param {object} data
 * @param {Uploader} data.uploader
 * @param {Contact[]} data.contacts
 * @param {Set<string>} data.partnerDomains
 * @param {Set<string>} data.customerDomains
 */
export async function findAndFlagExternallyCreatedContacts({ uploader, contacts, partnerDomains, customerDomains }) {
  // Only check contacts with no contact_type and with email
  const candidates = contacts.filter(c => c.contact_type === null && c.email);

  const partners = candidates.filter(c => partnerDomains.has(c.email.split('@')[1]));
  const customers = candidates.filter(c => customerDomains.has(c.email.split('@')[1]));

  // Fix them mutably for rest of engine run
  for (const c of partners) { c.contact_type = 'Partner'; }
  for (const c of customers) { c.contact_type = 'Customer'; }

  await uploader.updateAllContacts([...partners, ...customers].map(c => ({
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
 * @param {Set<string>} set
 * @param {string | undefined} email
 */
function maybeAddDomain(set, email) {
  if (!email) return;
  const domain = email.split('@')[1];
  set.add(domain);
}
