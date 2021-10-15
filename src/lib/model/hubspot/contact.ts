import { SimplePublicObject } from "@hubspot/api-client/lib/codegen/crm/contacts/api";
import { Company } from "./company.js";
import { HubspotEntity } from "./entity.js";
import { HubspotEntityKind, HubspotEntityManager } from "./manager.js";

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
  licenseTier: number;
  lastMpacEvent: string;
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
      licenseTier: +data.license_tier,
      deployment: data.deployment as ContactProps['deployment'],
      lastMpacEvent: data.last_mpac_event,
    };
  }

  override toAPI(props: ContactProps) {
    return {
      contact_type: props.contactType,

      email: props.email,
      hosting: props.hosting,
      country: props.country,
      region: props.region,

      firstname: props.firstName?.trim() || '',
      lastname: props.lastName?.trim() || '',
      phone: props.phone?.trim() || '',
      city: props.city?.trim() || '',
      state: props.state?.trim() || '',

      related_products: props.relatedProducts.join(';'),
      license_tier: props.licenseTier.toFixed(),
      deployment: props.deployment,
      last_mpac_event: props.lastMpacEvent,
    };
  }

}
