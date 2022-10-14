import capitalize from "capitalize";
import { Contact, ContactData, ContactManager, ContactType } from '../model/contact';
import { License } from '../model/license';
import { ContactInfo, PartnerBillingInfo } from "../model/record";
import { Transaction } from '../model/transaction';
import { sorter } from '../util/helpers';

export type GeneratedContact = ContactData & { lastUpdated: string };

export class ContactGenerator {

  private toMerge = new Map<Contact, GeneratedContact[]>();

  public constructor(
    private licenses: License[],
    private transactions: Transaction[],
    private contactManager: ContactManager,
    private partnerDomains: Set<string>,
    private archivedApps: Set<string>,
  ) { }

  public run() {
    this.generateContacts();
    this.mergeGeneratedContacts();
    this.associateContacts();
    this.sortContactRecords();
  }

  private generateContacts() {
    for (const record of [...this.licenses, ...this.transactions]) {
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
    for (const record of [...this.licenses, ...this.transactions]) {
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
    for (const contact of this.contactManager.getAll()) {
      contact.records.sort(sorter(r => r.data.maintenanceStartDate, 'DSC'));
    }
  }

  private findContact(email: string | undefined): Contact | null {
    if (!email) return null;
    return this.contactManager.getByEmail(email)!;
  }

  private generateContact(item: License | Transaction, info: ContactInfo | PartnerBillingInfo | null) {
    if (!info || (!info.email && !info.name)) return;
    const generated = this.contactFrom(item, info);

    let contact = this.contactManager.getByEmail(generated.email);
    if (!contact) {
      const { lastUpdated, ...generatedWithoutLastUpdated } = generated;
      contact = this.contactManager.create(generatedWithoutLastUpdated);
    }

    let entry = this.toMerge.get(contact);
    if (!entry) this.toMerge.set(contact, entry = []);
    entry.push(generated);
  }

  private contactFrom(item: License | Transaction, info: ContactInfo | PartnerBillingInfo): GeneratedContact {
    const [firstNameRaw, ...lastNameGroup] = (info.name || ' ').split(' ');
    let firstName = firstNameRaw;
    let lastName = lastNameGroup.filter(n => n).join(' ');

    const NAME_URL_RE = /(.)\.([a-zA-Z]{2})/g;
    if (firstName.match(NAME_URL_RE)) firstName = firstName.replace(NAME_URL_RE, '$1_$2');
    if (lastName.match(NAME_URL_RE)) lastName = lastName.replace(NAME_URL_RE, '$1_$2');

    const domain = info.email.split('@')[1];
    const contactType: ContactType = (this.partnerDomains.has(domain) ? 'Partner' : 'Customer');

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
      deployment: new Set([item.data.hosting]),
      products: new Set([item.data.addonKey].filter(key => notIgnored(this.archivedApps, key))),
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
    for (const deployment of other.deployment) {
      contact.deployment.add(deployment);
    }
  }
}

function notIgnored(archivedApps: Set<string>, addonKey: string) {
  return !archivedApps.has(addonKey);
}
