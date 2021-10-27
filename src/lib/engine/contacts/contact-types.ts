import config from '../../config/index.js';
import { Contact } from '../../model/contact.js';
import { Database } from '../../model/database.js';
import { License } from '../../model/license.js';
import { Transaction } from '../../model/transaction.js';

export function identifyAndFlagContactTypes(db: Database) {
  // Identifying contact types
  identifyContactTypesFromRecordDomains(db, db.licenses);
  identifyContactTypesFromRecordDomains(db, db.transactions);
  addPartnerDomainsFromEnv(db);
  removeProviderDomainsFromPartnerDomains(db);
  separatePartnerDomainsFromCustomerDomains(db);

  // Flagging contacts and companies
  flagKnownContactTypesByDomain(db);
  setPartnerDomainsViaCoworkers(db);
}

function identifyContactTypesFromRecordDomains(db: Database, records: (Transaction | License)[]) {
  for (const record of records) {
    maybeAddDomain(db.partnerDomains, record.data.partnerDetails?.billingContact.email);
    maybeAddDomain(db.customerDomains, record.data.billingContact?.email);
    maybeAddDomain(db.customerDomains, record.data.technicalContact.email);
  }
}

function addPartnerDomainsFromEnv(db: Database) {
  for (const domain of config.engine.partnerDomains) {
    db.partnerDomains.add(domain);
  }
}

function removeProviderDomainsFromPartnerDomains(db: Database) {
  for (const domain of db.providerDomains) {
    db.partnerDomains.delete(domain);
  }
}

function separatePartnerDomainsFromCustomerDomains(db: Database) {
  // If it's a partner domain, then it's not a customer domain
  for (const domain of db.partnerDomains) {
    db.customerDomains.delete(domain);
  }
}

function flagKnownContactTypesByDomain(db: Database) {
  for (const contact of db.contactManager.getAll()) {
    if (usesDomains(contact, db.partnerDomains)) {
      contact.data.contactType = 'Partner';
    }
    else if (usesDomains(contact, db.customerDomains)) {
      contact.data.contactType = 'Customer';
    }
  }
}

function setPartnerDomainsViaCoworkers(db: Database) {
  for (const contact of db.contactManager.getAll()) {
    const companies = contact.companies.getAll();
    const coworkers = companies.flatMap(company =>
      db.contactManager.getArray().filter(other =>
        other.companies.getAll().includes(company)));

    if (coworkers.some(c => c.isPartner)) {
      for (const coworker of coworkers) {
        coworker.data.contactType = 'Partner';
      }
      for (const company of companies) {
        company.data.type = 'Partner';
      }
    }
  }
}

function maybeAddDomain(set: Set<string>, email: string | undefined) {
  if (email) set.add(domainFor(email));
}

function usesDomains(contact: Contact, domains: Set<string>) {
  return contact.allEmails.some(email => domains.has(domainFor(email)));
}

function domainFor(email: string): string {
  return email.split('@')[1];
}
