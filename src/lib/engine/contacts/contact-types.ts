import { Contact, domainFor } from "../../model/contact";
import { License } from "../../model/license";
import { Transaction } from "../../model/transaction";
import { Engine } from "../engine";

export function identifyAndFlagContactTypes(engine: Engine) {
  // Identifying contact types
  identifyContactTypesFromRecordDomains(engine, engine.licenses);
  identifyContactTypesFromRecordDomains(engine, engine.transactions);
  removeFreeEmailDomainsFromPartnerDomains(engine);
  separatePartnerDomainsFromCustomerDomains(engine);

  // Flagging contacts and companies
  flagKnownContactTypesByDomain(engine);
  setPartnersViaCoworkers(engine);
}

function identifyContactTypesFromRecordDomains(engine: Engine, records: (Transaction | License)[]) {
  for (const record of records) {
    maybeAddDomain(engine.partnerDomains, record.data.partnerDetails?.billingContact.email);
    maybeAddDomain(engine.customerDomains, record.data.billingContact?.email);
    maybeAddDomain(engine.customerDomains, record.data.technicalContact.email);
  }
}

function removeFreeEmailDomainsFromPartnerDomains(engine: Engine) {
  for (const domain of engine.freeEmailDomains) {
    engine.partnerDomains.delete(domain);
    engine.customerDomains.add(domain);
  }
}

function separatePartnerDomainsFromCustomerDomains(engine: Engine) {
  // If it's a partner domain, then it's not a customer domain
  for (const domain of engine.partnerDomains) {
    engine.customerDomains.delete(domain);
  }
}

function flagKnownContactTypesByDomain(engine: Engine) {
  for (const contact of engine.contactManager.getAll()) {
    if (usesDomains(contact, engine.partnerDomains)) {
      contact.data.contactType = 'Partner';
    }
    else if (usesDomains(contact, engine.customerDomains)) {
      contact.data.contactType = 'Customer';
    }
  }
}

function setPartnersViaCoworkers(engine: Engine) {
  for (const contact of engine.contactManager.getAll()) {
    const companies = contact.companies.getAll();
    const coworkers = companies.flatMap(company => company.contacts.getAll());
    flagPartnersViaCoworkers(coworkers);
  }
}

export function flagPartnersViaCoworkers(coworkers: Contact[]) {
  if (coworkers.some(c => c.isPartner)) {
    for (const coworker of coworkers) {
      coworker.data.contactType = 'Partner';
      for (const company of coworker.companies.getAll()) {
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
