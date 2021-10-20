import { GeneratedContact } from '../types/contact.js';

export function contactToHubspotProperties(contact: Partial<GeneratedContact>): { [key: string]: string } {
  const props: { [key: string]: string } = {};

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
