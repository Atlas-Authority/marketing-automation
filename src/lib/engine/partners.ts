import config from '../config/index.js';
import { Database } from '../model/database.js';
import { Contact } from '../model/hubspot/contact.js';

export function identifyDomains(db: Database) {
  for (const l of db.licenses) {
    maybeAddDomain(db.partnerDomains, l.data.partnerDetails?.billingContact.email);
    maybeAddDomain(db.customerDomains, l.data.billingContact?.email);
  }

  for (const tx of db.transactions) {
    maybeAddDomain(db.partnerDomains, tx.data.partnerDetails?.billingContact.email);
    maybeAddDomain(db.customerDomains, tx.data.billingContact?.email);
    maybeAddDomain(db.customerDomains, tx.data.technicalContact.email);
  }

  for (const domain of config.engine.partnerDomains) {
    db.partnerDomains.add(domain);
  }

  for (const domain of db.customerDomains) {
    db.partnerDomains.delete(domain);
  }
}

export function findAndFlagExternallyCreatedContacts(db: Database) {
  // Only check contacts with no contact_type and with email
  const candidates = db.contactManager.getArray().filter(c => c.data.contactType === null && c.data.email);

  const partners = candidates.filter(c => db.partnerDomains.has(c.data.email.split('@')[1]));
  const customers = candidates.filter(c => db.customerDomains.has(c.data.email.split('@')[1]));

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
  const domainToContacts = new Map<string, Contact[]>();

  for (const sc of db.contactManager.getAll()) {
    if (!sc.data.email || !sc.data.contactType) continue;

    const domain = sc.data.email.split('@')[1];
    if (!domainToContacts.has(domain)) domainToContacts.set(domain, []);
    domainToContacts.get(domain)?.push(sc);
  }

  for (const domain of db.providerDomains) {
    domainToContacts.delete(domain);
  }

  const partnerDomains = new Set([...domainToContacts]
    .filter(([, contacts]) =>
      contacts.some(c => c.data.contactType === 'Partner'))
    .map(([domain,]) => domain));

  for (const contact of db.contactManager.getAll()) {
    const domain = contact.data.email.split('@')[1];
    if (partnerDomains.has(domain)) {
      contact.data.contactType = 'Partner';
    }
  }
}

function maybeAddDomain(set: Set<string>, email: string | undefined) {
  if (!email) return;
  const domain = email.split('@')[1];
  set.add(domain);
}
