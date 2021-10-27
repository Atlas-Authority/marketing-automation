import config from '../../config/index.js';
import { Contact } from '../../model/contact.js';
import { Database } from '../../model/database.js';

export function identifyDomains(db: Database) {
  for (const l of db.licenses) {
    maybeAddDomain(db.partnerDomains, l.data.partnerDetails?.billingContact.email);
    maybeAddDomain(db.customerDomains, l.data.billingContact?.email);
    maybeAddDomain(db.customerDomains, l.data.technicalContact.email);
  }

  for (const tx of db.transactions) {
    maybeAddDomain(db.partnerDomains, tx.data.partnerDetails?.billingContact.email);
    maybeAddDomain(db.customerDomains, tx.data.billingContact?.email);
    maybeAddDomain(db.customerDomains, tx.data.technicalContact.email);
  }

  for (const domain of config.engine.partnerDomains) {
    db.partnerDomains.add(domain);
  }

  // If it's a partner domain, then it's not a customer domain
  for (const domain of db.partnerDomains) {
    db.customerDomains.delete(domain);
  }
}

export function findAndFlagExternallyCreatedContacts(db: Database) {
  // Only check contacts with no contact_type and with email
  const candidates = db.contactManager.getArray().filter(c => c.data.contactType === null && c.data.email);

  const partners = candidates.filter(c => db.partnerDomains.has(domainFor(c.data.email)));
  const customers = candidates.filter(c => db.customerDomains.has(domainFor(c.data.email)));

  for (const c of partners) { c.data.contactType = 'Partner'; }
  for (const c of customers) { c.data.contactType = 'Customer'; }
}

export function findAndFlagPartnerCompanies(db: Database) {
  for (const contact of db.contactManager.getAll()) {
    if (contact.data.contactType === 'Partner') {
      for (const company of contact.companies.getAll()) {
        company.data.type = 'Partner';
      }
    }
  }
}

export function findAndFlagPartnersByDomain(db: Database) {
  const contactsByDomain = new Map<string, Contact[]>();

  for (const contact of db.contactManager.getAll()) {
    for (const email of contact.allEmails) {
      const domain = domainFor(email);
      let contacts = contactsByDomain.get(domain);
      if (!contacts) contactsByDomain.set(domain, contacts = []);
      contacts.push(contact);
    }
  }

  for (const domain of db.providerDomains) {
    contactsByDomain.delete(domain);
  }

  const partnerDomains = new Set([...contactsByDomain]
    .filter(([, contacts]) => contacts.some(c => c.isPartner))
    .map(([domain,]) => domain));

  for (const contact of db.contactManager.getAll()) {
    const domains = contact.allEmails.map(domainFor);
    if (domains.some(domain => partnerDomains.has(domain))) {
      contact.data.contactType = 'Partner';
    }
  }
}

function maybeAddDomain(set: Set<string>, email: string | undefined) {
  if (email) set.add(domainFor(email));
}

function domainFor(email: string): string {
  return email.split('@')[1];
}
