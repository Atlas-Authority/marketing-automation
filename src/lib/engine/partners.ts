import { Company } from '../types/company.js';
import { Contact, GeneratedContact } from '../types/contact.js';
import { Uploader } from '../io/uploader/uploader.js';
import config from '../config/index.js';
import { Database } from '../model/database.js';

export function identifyDomains(db: Database) {
  for (const l of db.licenses) {
    maybeAddDomain(db.partnerDomains, l.data.billingContact?.email);
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

export async function findAndFlagExternallyCreatedContacts(db: Database) {
  // Only check contacts with no contact_type and with email
  const candidates = [...db.contactManager.getAll()].filter(c => c.data.contactType === null && c.data.email);

  const partners = candidates.filter(c => db.partnerDomains.has(c.data.email.split('@')[1]));
  const customers = candidates.filter(c => db.customerDomains.has(c.data.email.split('@')[1]));

  for (const c of partners) { c.data.contactType = 'Partner'; }
  for (const c of customers) { c.data.contactType = 'Customer'; }
}

export async function findAndFlagPartnerCompanies({ uploader, contacts, companies }: {
  uploader: Uploader,
  contacts: GeneratedContact[],
  companies: Company[],
}) {
  const companyUpdates: { id: string, properties: { [key: string]: string } }[] = [];

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

export function findAndFlagPartnersByDomain({ contacts, sourceContacts, providerDomains }: {
  contacts: GeneratedContact[],
  sourceContacts: Contact[],
  providerDomains: Set<string>,
}) {
  const domainToContacts = new Map<string, Contact[]>();

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

function maybeAddDomain(set: Set<string>, email: string | undefined) {
  if (!email) return;
  const domain = email.split('@')[1];
  set.add(domain);
}
