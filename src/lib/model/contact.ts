import { Entity } from "../hubspot/entity";
import { EntityAdapter } from "../hubspot/interfaces";
import { EntityManager } from "../hubspot/manager";
import { Company } from "./company";
import { License } from "./license";
import { Transaction } from "./transaction";

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

  products: Set<string>;
  deployment: Set<string>;

  relatedProducts: Set<string>;
  licenseTier: number | null;
  lastMpacEvent: string | null;

  lastAssociatedPartner: string | null;
};

export class Contact extends Entity<ContactData> {

  public companies = this.makeDynamicAssociation<Company>('company');

  public get isExternal() { return !this.data.email || !this.data.contactType; }

  public get allEmails() { return [this.data.email, ...this.otherEmails()]; }
  public get isPartner() { return this.data.contactType === 'Partner'; }
  public get isCustomer() { return this.data.contactType === 'Customer'; }

  /** Sorted newest first */
  public records: (License | Transaction)[] = [];

  otherEmails() {
    return this.downloadedData['hs_additional_emails']?.split(';') || [];
  }

}

export interface HubspotContactConfig {
  attrs?: {
    deployment?: string,
    licenseTier?: string,
    products?: string,
    lastMpacEvent?: string,
    contactType?: string,
    region?: string,
    relatedProducts?: string,
    lastAssociatedPartner?: string,
  },
  managedFields?: Set<string>,
}

function makeAdapter(config: HubspotContactConfig): EntityAdapter<ContactData> {

  return {

    kind: 'contact',

    associations: {
      company: 'down/up',
    },

    data: {
      contactType: {
        property: config.attrs?.contactType,
        down: contact_type => contact_type as ContactType,
        up: contactType => contactType ?? '',
      },

      email: {
        property: 'email',
        identifier: true,
        down: email => email ?? '',
        up: email => email,
      },
      country: {
        property: 'country',
        down: country => country,
        up: country => country ?? '',
      },
      region: {
        property: config.attrs?.region,
        down: region => region,
        up: region => region ?? '',
      },

      firstName: {
        property: 'firstname',
        down: firstname => firstname?.trim() || null,
        up: firstName => firstName?.trim() || '',
      },
      lastName: {
        property: 'lastname',
        down: lastname => lastname?.trim() || null,
        up: lastName => lastName?.trim() || '',
      },
      phone: {
        property: 'phone',
        down: phone => phone?.trim() || null,
        up: phone => phone?.trim() || '',
      },
      city: {
        property: 'city',
        down: city => city?.trim() || null,
        up: city => city?.trim() || '',
      },
      state: {
        property: 'state',
        down: state => state?.trim() || null,
        up: state => state?.trim() || '',
      },

      relatedProducts: {
        property: config.attrs?.relatedProducts,
        down: related_products => new Set(related_products ? related_products.split(';') : []),
        up: relatedProducts => [...relatedProducts].join(';'),
        makeComparable: setToComparableString,
      },
      licenseTier: {
        property: config.attrs?.licenseTier,
        down: licenseTier => licenseTier ? +licenseTier.trim() : null,
        up: licenseTier => licenseTier?.toFixed() ?? '',
      },
      deployment: {
        property: config.attrs?.deployment,
        down: deployment => new Set(deployment?.split(';') ?? []),
        up: deployment => [...deployment].join(';'),
        makeComparable: setToComparableString,
      },
      products: {
        property: config.attrs?.products,
        down: products => new Set(products?.split(';') || []),
        up: products => [...products].join(';'),
        makeComparable: setToComparableString,
      },
      lastMpacEvent: {
        property: config.attrs?.lastMpacEvent,
        down: last_mpac_event => last_mpac_event,
        up: lastMpacEvent => lastMpacEvent ?? '',
      },
      lastAssociatedPartner: {
        property: config.attrs?.lastAssociatedPartner,
        down: partner => partner || null,
        up: partner => partner ?? '',
      },
    },

    additionalProperties: ['hs_additional_emails'],

    managedFields: config.managedFields ?? new Set(),

  };
}


export class ContactManager extends EntityManager<ContactData, Contact> {

  protected override Entity = Contact;
  public override entityAdapter: EntityAdapter<ContactData>;

  public getByEmail = this.makeIndex(c => c.allEmails, ['email']);

  constructor(typeMappings: Map<string, string>, config: HubspotContactConfig) {
    super(typeMappings);
    this.entityAdapter = makeAdapter(config);
  }

}

export function domainFor(email: string): string {
  return email.split('@')[1];
}

function setToComparableString(a: Set<string>) {
  return [...a].sort().join();
}
