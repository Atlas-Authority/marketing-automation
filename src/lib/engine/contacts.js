import { nonBlankString } from '../util/helpers.js';
import assert from 'assert';

/**
 * @param {Contact[]} contacts
 */
export function buildContactsStructure(contacts) {
  /** @type {{ [key: string]: Contact }} */
  const contactsByEmail = {};

  for (const contact of contacts) {
    for (const email of [contact.email, ...contact.otherEmails]) {
      contactsByEmail[email] = contact;
    }
  }

  return contactsByEmail;
}

/**
 * @param {import('@hubspot/api-client').contactsModels.SimplePublicObject} contact
 * @returns {Contact}
 */
export function contactFromHubspot(contact) {
  let { related_products, license_tier, ...properties } = contact.properties;

  return {
    hs_object_id: contact.id,

    email: properties['email'],
    hosting: properties['hosting'],
    country: properties['country'],
    region: properties['region'],
    firstname: nonBlankString(properties['firstname']),
    lastname: nonBlankString(properties['lastname']),
    phone: nonBlankString(properties['phone']),
    city: nonBlankString(properties['city']),
    state: nonBlankString(properties['state']),
    last_mpac_event: properties['last_mpac_event'],

    contact_type: /** @type {any} */(properties['contact_type']),
    deployment: /** @type {any} */(properties['deployment']),

    related_products: related_products ? related_products.split(';') : [],
    license_tier: (typeof license_tier === 'string' && license_tier.length > 0)
      ? +license_tier
      : undefined,

    otherEmails: properties['hs_additional_emails']?.split(';') || [],

    company_id: contact.associations?.companies.results
      .find(r => r.type === 'contact_to_company')?.id
      || null,
  };
}

/**
 * @param {Partial<GeneratedContact>} contact
 * @returns {{ [key: string]: string }}
 */
export function contactToHubspotProperties(contact) {
  /** @type {{ [key: string]: string }} */
  const props = {};

  if ('contact_type' in contact) props.contact_type = contact.contact_type || '';
  if ('email' in contact) props.email = contact.email || '';
  if ('hosting' in contact) props.hosting = contact.hosting || '';
  if ('country' in contact) props.country = contact.country || '';
  if ('region' in contact) props.region = contact.region || '';

  if ('firstname' in contact) props.firstname = contact.firstname || '';
  if ('lastname' in contact) props.lastname = contact.lastname || '';
  if ('city' in contact) props.city = contact.city || '';
  if ('state' in contact) props.state = contact.state || '';
  if ('phone' in contact) props.phone = contact.phone || '';

  if (contact.last_mpac_event) props.last_mpac_event = contact.last_mpac_event;
  if (contact.license_tier !== undefined) props.license_tier = contact.license_tier.toFixed();
  if (contact.deployment) props.deployment = contact.deployment;
  if (contact.related_products) props.related_products = contact.related_products.join(';');

  return props;
}
