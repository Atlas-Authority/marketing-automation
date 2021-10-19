import { EntityKind } from "../../io/hubspot.js";
import { Company } from "./company.js";
import { HubspotEntity } from "./entity.js";
import { HubspotEntityManager, HubspotPropertyTransformers } from "./manager.js";

type ContactProps = {
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;

  contactType: 'Partner' | 'Customer';

  country: string;
  region: string;

  hosting: string;
  deployment: 'Cloud' | 'Data Center' | 'Server' | 'Multiple';

  relatedProducts: string[];
  licenseTier: number | null;
  lastMpacEvent: string;

  otherEmails: string[];
};

export class Contact extends HubspotEntity<ContactProps> {

  companies = this.makeDynamicAssociation<Company>('company');

}

export class ContactManager extends HubspotEntityManager<ContactProps, Contact> {

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
    'hosting',
    'firstname',
    'lastname',
    'phone',
    'deployment',
    'related_products',
    'license_tier',
    'last_mpac_event',
    'hs_additional_emails',
  ];

  override fromAPI(data: { [key: string]: string }): ContactProps | null {
    return {
      contactType: data.contact_type as ContactProps['contactType'],

      email: data.email,
      hosting: data.hosting,
      country: data.country,
      region: data.region,

      firstName: data.firstname || '',
      lastName: data.lastname || '',
      phone: data.phone || '',
      city: data.city || '',
      state: data.state || '',

      relatedProducts: data.related_products ? data.related_products.split(';') : [],
      licenseTier: data.license_tier === '' ? null : +data.license_tier,
      deployment: data.deployment as ContactProps['deployment'],
      lastMpacEvent: data.last_mpac_event,

      otherEmails: data.hs_additional_emails?.split(';') || [],
    };
  }

  override toAPI: HubspotPropertyTransformers<ContactProps> = {
    contactType: contactType => ['contact_type', contactType],

    email: email => ['email', email],
    hosting: hosting => ['hosting', hosting],
    country: country => ['country', country],
    region: region => ['region', region],

    firstName: firstName => ['firstname', firstName?.trim() || ''],
    lastName: lastName => ['lastname', lastName?.trim() || ''],
    phone: phone => ['phone', phone?.trim() || ''],
    city: city => ['city', city?.trim() || ''],
    state: state => ['state', state?.trim() || ''],

    relatedProducts: relatedProducts => ['related_products', relatedProducts.join(';')],
    licenseTier: licenseTier => ['license_tier', licenseTier?.toFixed() ?? ''],
    deployment: deployment => ['deployment', deployment],
    lastMpacEvent: lastMpacEvent => ['last_mpac_event', lastMpacEvent],

    // Never sync'd up
    otherEmails: () => ['', ''],
  };

  override identifiers: (keyof ContactProps)[] = [
    'email',
  ];

}
