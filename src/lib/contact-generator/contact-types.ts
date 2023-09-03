import { Contact, ContactManager, domainFor } from "../model/contact";
import { License } from "../model/license";
import { Transaction } from "../model/transaction";

export class ContactTypeFlagger {

  constructor(
    private licenses: License[],
    private transactions: Transaction[],
    private contactManager: ContactManager,
    private freeEmailDomains: Set<string>,
    private partnerDomains: Set<string>,
    private customerDomains: Set<string>,
  ) { }

  public identifyAndFlagContactTypes() {
    // Identifying contact types
    this.identifyContactTypesFromRecordDomains(this.licenses);
    this.identifyContactTypesFromRecordDomains(this.transactions);
    this.removeFreeEmailDomainsFromPartnerDomains();
    this.separatePartnerDomainsFromCustomerDomains();

    // Flagging contacts and companies
    this.flagKnownContactTypesByDomain();
    this.setPartnersViaCoworkers();
  }

  private identifyContactTypesFromRecordDomains(records: (Transaction | License)[]) {
    for (const record of records) {
      maybeAddDomain(this.partnerDomains, record.data.partnerDetails?.billingContact.email);
      maybeAddDomain(this.customerDomains, record.data.billingContact?.email);
      maybeAddDomain(this.customerDomains, record.data.technicalContact?.email);
    }
  }

  private removeFreeEmailDomainsFromPartnerDomains() {
    for (const domain of this.freeEmailDomains) {
      this.partnerDomains.delete(domain);
      this.customerDomains.add(domain);
    }
  }

  private separatePartnerDomainsFromCustomerDomains() {
    // If it's a partner domain, then it's not a customer domain
    for (const domain of this.partnerDomains) {
      this.customerDomains.delete(domain);
    }
  }

  private flagKnownContactTypesByDomain() {
    for (const contact of this.contactManager.getAll()) {
      if (usesDomains(contact, this.partnerDomains)) {
        contact.data.contactType = 'Partner';
      }
      else if (usesDomains(contact, this.customerDomains)) {
        contact.data.contactType = 'Customer';
      }
    }
  }

  private setPartnersViaCoworkers() {
    for (const contact of this.contactManager.getAll()) {
      const companies = contact.companies.getAll();
      const coworkers = companies.flatMap(company => company.contacts.getAll());
      flagPartnersViaCoworkers(coworkers);
    }
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
