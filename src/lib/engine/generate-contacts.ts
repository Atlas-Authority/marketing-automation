import capitalize from 'capitalize';
import { Database } from '../model/database.js';
import { Contact, ContactProps, ContactType } from '../model/hubspot/contact.js';
import { ContactInfo, PartnerBillingInfo } from '../model/marketplace/common.js';
import { License } from '../model/marketplace/license.js';
import { Transaction } from '../model/marketplace/transaction.js';
import { sorter } from '../util/helpers.js';

export function generateContacts(db: Database) {
  const gen = new ContactGenerator(db);
  gen.generateContacts();
  gen.mergeGeneratedContacts();
}

type GeneratedContact = ContactProps & { lastUpdated: string };

class ContactGenerator {

  toMerge = new Map<Contact, GeneratedContact[]>();

  constructor(private db: Database) { }

  generateContacts() {
    for (const license of this.db.licenses) {
      this.generateContact(license, license.data.technicalContact);
      this.generateContact(license, license.data.billingContact);
      this.generateContact(license, license.data.partnerDetails?.billingContact ?? null);
    }
    for (const transaction of this.db.transactions) {
      this.generateContact(transaction, transaction.data.technicalContact);
      this.generateContact(transaction, transaction.data.billingContact);
      this.generateContact(transaction, transaction.data.partnerDetails?.billingContact ?? null);
    }
  }

  generateContact(item: License | Transaction, info: ContactInfo | PartnerBillingInfo | null) {
    if (!info) return;
    const generated = this.contactFrom(item, info);

    let contact = this.db.contactManager.getByEmail(generated.email);
    if (!contact) contact = this.db.contactManager.create(generated);

    let entry = this.toMerge.get(contact);
    if (!entry) this.toMerge.set(contact, entry = []);
    entry.push(generated);
  }

  contactFrom(item: License | Transaction, info: ContactInfo | PartnerBillingInfo): GeneratedContact {
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
      hosting: item.data.hosting,
      otherEmails: [],
      licenseTier: null,
      lastMpacEvent: '',
      lastUpdated: (item instanceof License ? item.data.lastUpdated : item.data.saleDate),
    };
  }

  mergeGeneratedContacts() {
    for (const [contact, contacts] of this.toMerge) {
      const currentContactProps = {
        ...contact.data,
        lastUpdated: contact.data.lastMpacEvent ?? '',
      };
      contacts.push(currentContactProps);

      if (contacts.some(c => c.contactType === 'Partner')) {
        contact.data.contactType = 'Partner';
      }

      contacts.sort(sorter(c => c.lastUpdated, 'DSC'));

      const hasName = contacts.find(c => c.firstName && c.lastName);
      if (hasName) {
        contact.data.firstName = hasName.firstName;
        contact.data.lastName = hasName.lastName;
      }
      else {
        const hasFirstName = contacts.find(c => c.firstName);
        if (hasFirstName) contact.data.firstName = hasFirstName.firstName;

        const hasLastName = contacts.find(c => c.lastName);
        if (hasLastName) contact.data.lastName = hasLastName.lastName;
      }

      const hasPhone = contacts.find(c => c.phone);
      if (hasPhone) {
        contact.data.phone = hasPhone.phone;
      }

      const hasAddress = contacts.find(c => c.city && c.state);
      if (hasAddress) {
        contact.data.city = hasAddress.city;
        contact.data.state = hasAddress.state;
      }
      else {
        const hasCity = contacts.find(c => c.city);
        if (hasCity) contact.data.city = hasCity.city;

        const hasState = contacts.find(c => c.state);
        if (hasState) contact.data.state = hasState.state;
      }
    }
  }

}
