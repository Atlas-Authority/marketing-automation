import { HubspotEntity } from "./entity.js";

export type HubspotInputObject = {
  id: string,
  properties: { [key: string]: string },
  createdAt: Date,
  updatedAt: Date,
  archived?: boolean,
  archivedAt?: Date,
  associations?: {
    [key: string]: {
      results: {
        id: string,
        type: string,
      }[],
    },
  },
};

export type HubspotEntityKind = 'deal' | 'contact' | 'company';

export abstract class HubspotEntityManager<
  P extends { [key: string]: any },
  E extends HubspotEntity<P>,
  I extends HubspotInputObject>
{

  abstract kind: HubspotEntityKind;
  abstract associations: [keyof E, HubspotEntityKind][];

  abstract apiProperties: string[];
  abstract fromAPI(data: I['properties']): P;
  abstract toAPI(props: P): I['properties'];

}
