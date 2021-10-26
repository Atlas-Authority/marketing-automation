import config from "../config/index.js";
import { EntityKind } from "../io/hubspot.js";
import { Company } from "./company.js";
import { Entity } from "./hubspot/entity.js";
import { EntityManager, PropertyTransformers } from "./hubspot/manager.js";

const deploymentKey = config.hubspot.attrs.contact.deployment;
const productsKey = config.hubspot.attrs.contact.products;

export type ContactType = 'Partner' | 'Customer';

export type ContactData = {
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;

  contactType: ContactType;

  country: string | null;
  region: string | null;

  products: Set<string>;
  deployment: 'Cloud' | 'Data Center' | 'Server' | 'Multiple' | null;

  relatedProducts: Set<string>;
  licenseTier: number | null;
  lastMpacEvent: string | null;

  readonly otherEmails: readonly string[];
};

export class Contact extends Entity<ContactData> {

  companies = this.makeDynamicAssociation<Company>('company');

  get isExternal() { return !this.data.email || !this.data.contactType; }

  get allEmails() { return [this.data.email, ...this.data.otherEmails]; }
  get isPartner() { return this.data.contactType === 'Partner'; }
  get isCustomer() { return this.data.contactType === 'Customer'; }

}

export class ContactManager extends EntityManager<ContactData, Contact> {

  override Entity = Contact;
  override kind: EntityKind = 'contact';

  override associations: EntityKind[] = [
    "company",
  ];

  override apiProperties: string[] = [
    'email',
    'city',
    'state',
    'country',
    'region',
    'contact_type',
    'firstname',
    'lastname',
    'phone',
    deploymentKey,
    productsKey,
    'related_products',
    'license_tier',
    'last_mpac_event',
    'hs_additional_emails',
  ];

  override fromAPI(data: { [key: string]: string | null }): ContactData | null {
    return {
      contactType: data['contact_type'] as ContactData['contactType'],

      email: data['email'] ?? '',
      country: data['country'],
      region: data['region'],

      firstName: data['firstname']?.trim() || null,
      lastName: data['lastname']?.trim() || null,
      phone: data['phone']?.trim() || null,
      city: data['city']?.trim() || null,
      state: data['state']?.trim() || null,

      relatedProducts: new Set(data['related_products'] ? data['related_products'].split(';') : []),
      licenseTier: !data['license_tier'] ? null : +data['license_tier'],
      deployment: data[deploymentKey] as ContactData['deployment'],
      products: new Set(data[productsKey]?.split(';') || []),
      lastMpacEvent: data['last_mpac_event'],

      otherEmails: data['hs_additional_emails']?.split(';') || [],
    };
  }

  override toAPI: PropertyTransformers<ContactData> = {
    contactType: contactType => ['contact_type', contactType],

    email: email => ['email', email],
    country: country => ['country', country ?? ''],
    region: region => ['region', region ?? ''],

    firstName: firstName => ['firstname', firstName?.trim() || ''],
    lastName: lastName => ['lastname', lastName?.trim() || ''],
    phone: phone => ['phone', phone?.trim() || ''],
    city: city => ['city', city?.trim() || ''],
    state: state => ['state', state?.trim() || ''],

    relatedProducts: relatedProducts => ['related_products', [...relatedProducts].join(';')],
    licenseTier: licenseTier => ['license_tier', licenseTier?.toFixed() ?? ''],
    deployment: deployment => [deploymentKey, deployment ?? ''],
    products: products => [productsKey, [...products].join(';')],
    lastMpacEvent: lastMpacEvent => ['last_mpac_event', lastMpacEvent ?? ''],

    otherEmails: EntityManager.downSyncOnly,
  };

  override identifiers: (keyof ContactData)[] = [
    'email',
  ];

  private contactsByEmail = this.makeIndex(c => c.allEmails);

  getByEmail(email: string) {
    return this.contactsByEmail.get(email);
  }

  removeExternallyCreatedContacts() {
    const externalContacts = this.getArray().filter(c => c.isExternal);
    this.removeLocally(externalContacts);
  }

}
