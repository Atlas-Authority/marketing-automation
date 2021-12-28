import capitalize from "capitalize";
import { Contact, ContactData, ContactType } from '../../model/contact';
import { Database } from '../../model/database';
import { License } from '../../model/license';
import { ContactInfo, PartnerBillingInfo } from '../../model/marketplace/common';
import { Transaction } from '../../model/transaction';
import env from "../../parameters/env-config";
import { sorter } from '../../util/helpers';

export type GeneratedContact = ContactData & { lastUpdated: string };

export class ContactGenerator {

  private toMerge = new Map<Contact, GeneratedContact[]>();

  public constructor(private db: Database) { }

  public run() {
    this.generateContacts();
    this.mergeGeneratedContacts();
    this.associateContacts();
    this.sortContactRecords();
  }

  private generateContacts() {
    for (const record of [...this.db.licenses, ...this.db.transactions]) {
      this.generateContact(record, record.data.technicalContact);
      this.generateContact(record, record.data.billingContact);
      this.generateContact(record, record.data.partnerDetails?.billingContact ?? null);
    }
  }

  private mergeGeneratedContacts() {
    for (const [contact, contacts] of this.toMerge) {
      contacts.sort(sorter(c => c.lastUpdated, 'DSC'));
      mergeContactInfo(contact.data, contacts);
    }
  }

  private associateContacts() {
    for (const record of [...this.db.licenses, ...this.db.transactions]) {
      record.techContact = this.findContact(record.data.technicalContact.email)!;
      record.billingContact = this.findContact(record.data.billingContact?.email);
      record.partnerContact = this.findContact(record.data.partnerDetails?.billingContact.email);

      record.allContacts.push(record.techContact);
      if (record.billingContact) record.allContacts.push(record.billingContact);
      if (record.partnerContact) record.allContacts.push(record.partnerContact);

      for (const contact of record.allContacts) {
        contact.records.push(record);
      }
    }
  }

  private sortContactRecords() {
    for (const contact of this.db.contactManager.getAll()) {
      contact.records.sort(sorter(r => r.data.maintenanceStartDate, 'DSC'));
    }
  }

  private findContact(email: string | undefined): Contact | null {
    if (!email) return null;
    return this.db.contactManager.getByEmail(email)!;
  }

  private generateContact(item: License | Transaction, info: ContactInfo | PartnerBillingInfo | null) {
    if (!info) return;
    const generated = this.contactFrom(item, info);

    let contact = this.db.contactManager.getByEmail(generated.email);
    if (!contact) {
      const { lastUpdated, ...generatedWithoutLastUpdated } = generated;
      contact = this.db.contactManager.create(generatedWithoutLastUpdated);
    }

    let entry = this.toMerge.get(contact);
    if (!entry) this.toMerge.set(contact, entry = []);
    entry.push(generated);
  }

  private contactFrom(item: License | Transaction, info: ContactInfo | PartnerBillingInfo): GeneratedContact {
    let [firstName, ...lastNameGroup] = (info.name || ' ').split(' ');
    let lastName = lastNameGroup.filter(n => n).join(' ');

    const NAME_URL_RE = /(.)\.([a-zA-Z]{2})/g;
    if (firstName.match(NAME_URL_RE)) firstName = firstName.replace(NAME_URL_RE, '$1_$2');
    if (lastName.match(NAME_URL_RE)) lastName = lastName.replace(NAME_URL_RE, '$1_$2');

    const domain = info.email.split('@')[1];
    const contactType: ContactType = (this.db.partnerDomains.has(domain) ? 'Partner' : 'Customer');

    return {
      email: info.email,
      contactType,
      firstName: capitalize.words(firstName).trim() || null,
      lastName: capitalize.words(lastName).trim() || null,
      phone: 'phone' in info ? info.phone?.trim() ?? null : null,
      city: 'city' in info ? capitalize.words(info.city || '') : null,
      state: 'state' in info ? capitalize.words(info.state || '') : null,
      country: capitalize.words(item.data.country),
      region: item.data.region,
      relatedProducts: new Set(),
      deployment: item.data.hosting,
      products: new Set([item.data.addonKey].filter(notIgnored)),
      licenseTier: null,
      lastMpacEvent: '',
      lastUpdated: (item instanceof License ? item.data.lastUpdated : item.data.saleDate),
      lastAssociatedPartner: null,
    };
  }

}

/** Don't use directly; only exported for tests; use ContactGenerator instead. */
export function mergeContactInfo(contact: ContactData, contacts: GeneratedContact[]) {
  const currentContactProps = {
    ...contact,
    lastUpdated: contact.lastMpacEvent ?? '',
  };
  contacts.push(currentContactProps);

  if (contacts.some(c => c.contactType === 'Partner')) {
    contact.contactType = 'Partner';
  }

  const hasName = contacts.find(c => c.firstName && c.lastName);
  if (hasName) {
    contact.firstName = hasName.firstName;
    contact.lastName = hasName.lastName;
  }
  else {
    const hasFirstName = contacts.find(c => c.firstName);
    if (hasFirstName)
      contact.firstName = hasFirstName.firstName;

    const hasLastName = contacts.find(c => c.lastName);
    if (hasLastName)
      contact.lastName = hasLastName.lastName;
  }

  const hasPhone = contacts.find(c => c.phone);
  if (hasPhone) {
    contact.phone = hasPhone.phone;
  }

  const hasAddress = contacts.find(c => c.city && c.state);
  if (hasAddress) {
    contact.city = hasAddress.city;
    contact.state = hasAddress.state;
  }
  else {
    const hasCity = contacts.find(c => c.city);
    if (hasCity)
      contact.city = hasCity.city;

    const hasState = contacts.find(c => c.state);
    if (hasState)
      contact.state = hasState.state;
  }

  for (const other of contacts) {
    for (const product of other.products) {
      contact.products.add(product);
    }
  }
}

function notIgnored(addonKey: string) {
  return !env.engine.ignoredApps.has(addonKey);
}
