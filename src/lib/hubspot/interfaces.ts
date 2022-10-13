export type NewEntity = { properties: Record<string, string> };
export type ExistingEntity = NewEntity & { id: string };
export type FullEntity = ExistingEntity & { associations: RelativeAssociation[] };

export type ResultEntity = {
  id: string | null,
  properties: Record<string, string>,
  associations: RelativeAssociation[],
};

export type RelativeAssociation = `${string}:${string}`;

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

export interface EntityAdapter<D> {

  kind: EntityKind;

  associations: Partial<Record<EntityKind, 'down' | 'down/up'>>;

  shouldReject?: (data: HubspotProperties) => boolean;

  data: { [K in keyof D]: {
    property: string | undefined,
    down: (data: string | null) => D[K],
    up: (data: D[K]) => string,
    makeComparable?: (v: D[K]) => string,
    identifier?: true,
  } };

  additionalProperties: string[],

  managedFields: Set<string>,

}
