import { SimplePublicObject } from "@hubspot/api-client/lib/codegen/crm/contacts/api";
import { Company } from "./company.js";
import { HubspotEntity } from "./entity.js";
import { HubspotEntityKind, HubspotEntityManager, HubspotPropertyTransformers } from "./manager.js";

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

  companies: Company[] = [];

}

class ContactManager extends HubspotEntityManager<ContactProps, Contact, SimplePublicObject> {

  override Entity = Contact;
  override kind: HubspotEntityKind = 'contact';

  override associations: [keyof Contact, HubspotEntityKind][] = [
    ["companies", "company"],
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

  override fromAPI(data: SimplePublicObject['properties']): ContactProps {
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

  override toAPI: HubspotPropertyTransformers = {
    contact_type: contactType => contactType,

    email: email => email,
    hosting: hosting => hosting,
    country: country => country,
    region: region => region,

    firstname: firstName => firstName?.trim() || '',
    lastname: lastName => lastName?.trim() || '',
    phone: phone => phone?.trim() || '',
    city: city => city?.trim() || '',
    state: state => state?.trim() || '',

    related_products: relatedProducts => relatedProducts.join(';'),
    license_tier: licenseTier => licenseTier?.toFixed() ?? '',
    deployment: deployment => deployment,
    last_mpac_event: lastMpacEvent => lastMpacEvent,

    // Never sync'd up
    otherEmails: () => '',
  };

}
