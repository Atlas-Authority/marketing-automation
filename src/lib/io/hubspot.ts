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
