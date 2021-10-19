import * as hubspot from '@hubspot/api-client';

export type NewEntity = { properties: { [key: string]: string } };
export type ExistingEntity = NewEntity & { id: string };
export type FullEntity = ExistingEntity & { associations: RelativeAssociation[] };

export type RelativeAssociation = `${EntityKind}:${string}`;

export type Association = {
  fromId: string,
  toId: string,
  toType: string,
};

export type EntityKind = 'deal' | 'contact' | 'company';

export function apiFor(client: hubspot.Client, kind: EntityKind) {
  switch (kind) {
    case 'deal': return client.crm.deals;
    case 'company': return client.crm.companies;
    case 'contact': return client.crm.contacts;
  }
}
