import { Uploader } from '../uploader/uploader.js';
import config from '../util/config.js';

export function identifyDomains(data: {
  licenses: License[],
  transactions: Transaction[],
}) {
  const partnerDomains = new Set<string>();
  const customerDomains = new Set<string>();

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

export async function findAndFlagExternallyCreatedContacts({ uploader, contacts, partnerDomains, customerDomains }: {
  uploader: Uploader,
  contacts: Contact[],
  partnerDomains: Set<string>,
  customerDomains: Set<string>,
}) {
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
