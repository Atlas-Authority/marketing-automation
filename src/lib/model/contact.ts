import env from "../parameters/env.js";
import { isPresent } from "../util/helpers.js";
import { Company } from "./company.js";
import { Entity } from "./hubspot/entity.js";
import { EntityKind } from "./hubspot/interfaces.js";
import { EntityAdapter, EntityManager } from "./hubspot/manager.js";

const deploymentKey = env.hubspot.attrs.contact.deployment;
const productsKey = env.hubspot.attrs.contact.products;
const licenseTierKey = env.hubspot.attrs.contact.licenseTier;

export type ContactType = 'Partner' | 'Customer';

export type ContactData = {
  readonly email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;

  contactType: ContactType | null;

  country: string | null;
  region: string | null;

  products: Set<string> | null;
  deployment: 'Cloud' | 'Data Center' | 'Server' | 'Multiple' | null;

  relatedProducts: Set<string>;
  licenseTier: number | null;
  lastMpacEvent: string | null;
};

type ContactComputed = {
  readonly otherEmails: readonly string[];
};

export class Contact extends Entity<ContactData, ContactComputed> {

  companies = this.makeDynamicAssociation<Company>('company');

  get isExternal() { return !this.data.email || !this.data.contactType; }

  get allEmails() { return [this.data.email, ...this.computed.otherEmails]; }
  get isPartner() { return this.data.contactType === 'Partner'; }
  get isCustomer() { return this.data.contactType === 'Customer'; }

}

const ContactAdapter: EntityAdapter<ContactData, ContactComputed> = {

  associations: [
    ['company', 'down/up'],
  ],

  apiProperties: [
    // Required
    'email',
    'city',
    'state',
    'country',
    'region',
    'contact_type',
    'firstname',
    'lastname',
    'phone',
    'related_products',
    'last_mpac_event',

    // User-configurable
    ...[
      deploymentKey,
      productsKey,
      licenseTierKey,
    ].filter(isPresent),
  ],

  fromAPI(data) {
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
      licenseTier: licenseTierKey ? toNumber(data[licenseTierKey]) : null,
      deployment: deploymentKey ? data[deploymentKey] as ContactData['deployment'] : null,
      products: productsKey ? new Set(data[productsKey]?.split(';') || []) : null,
      lastMpacEvent: data['last_mpac_event'],
    };
  },

  computed: {
    otherEmails: {
      default: [],
      down: data => data['hs_additional_emails']?.split(';') || [],
      properties: ['hs_additional_emails'],
    },
  },

  toAPI: {
    contactType: contactType => ['contact_type', contactType ?? ''],

    email: email => ['email', email],
    country: country => ['country', country ?? ''],
    region: region => ['region', region ?? ''],

    firstName: firstName => ['firstname', firstName?.trim() || ''],
    lastName: lastName => ['lastname', lastName?.trim() || ''],
    phone: phone => ['phone', phone?.trim() || ''],
    city: city => ['city', city?.trim() || ''],
    state: state => ['state', state?.trim() || ''],

    relatedProducts: relatedProducts => ['related_products', [...relatedProducts].join(';')],
    licenseTier: EntityManager.upSyncIfConfigured(licenseTierKey, licenseTier => licenseTier?.toFixed() ?? ''),
    deployment: EntityManager.upSyncIfConfigured(deploymentKey, deployment => deployment ?? ''),
    products: EntityManager.upSyncIfConfigured(productsKey, products => [...products ?? []].join(';')),
    lastMpacEvent: lastMpacEvent => ['last_mpac_event', lastMpacEvent ?? ''],
  },

  identifiers: [
    'email',
  ],

};

export class ContactManager extends EntityManager<ContactData, ContactComputed, Contact> {

  override Entity = Contact;
  override kind: EntityKind = 'contact';
  override entityAdapter = ContactAdapter;

  public getByEmail = this.makeIndex(c => c.allEmails, ['email']);

}

/** Returns number, or null for `''` and `null` */
function toNumber(val: string | null): number | null {
  return (val ? +val.trim() : null);
}
