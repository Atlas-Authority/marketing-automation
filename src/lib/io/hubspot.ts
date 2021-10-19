export type NewEntity = { properties: { [key: string]: string } };
export type ExistingEntity = NewEntity & { id: string };

export type FullEntity = ExistingEntity & {
  associations: {
    type: string;
    id: string;
  }[];
};

export type Association = {
  fromId: string,
  toId: string,
  toType: string,
};

export type EntityKind = 'deal' | 'contact' | 'company';
