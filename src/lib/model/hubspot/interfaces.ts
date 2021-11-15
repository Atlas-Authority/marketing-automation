export type NewEntity = { properties: Record<string, string> };
export type ExistingEntity = NewEntity & { id: string };
export type FullEntity = ExistingEntity & { associations: RelativeAssociation[] };

export type RelativeAssociation = `${EntityKind}:${string}`;

export type HubspotProperties = Record<string, string | null>;

export type Association = {
  fromId: string,
  toId: string,
  toType: string,
};

export type EntityKind = 'deal' | 'contact' | 'company';

export enum Pipeline {
  MPAC,
}

export enum DealStage {
  EVAL,
  CLOSED_WON,
  CLOSED_LOST,
}
