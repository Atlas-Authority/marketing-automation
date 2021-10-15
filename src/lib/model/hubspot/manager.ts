import * as hubspot from '@hubspot/api-client';
import * as assert from 'assert';
import { batchesOf } from '../../util/helpers.js';
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

export type HubspotPropertyTransformers<T> = {
  [P in keyof T]: (prop: T[P]) => [string, string]
};

export abstract class HubspotEntityManager<
  P extends { [key: string]: any },
  E extends HubspotEntity<P>,
  I extends HubspotInputObject>
{

  constructor(private client: hubspot.Client) { }

  abstract Entity: new (id: string | null, props: P) => E;
  abstract kind: HubspotEntityKind;
  abstract associations: [keyof E, HubspotEntityKind][];

  abstract apiProperties: string[];
  abstract fromAPI(data: I['properties']): P;
  abstract toAPI: HubspotPropertyTransformers<P>;

  entities: E[] = [];

  api() {
    switch (this.kind) {
      case 'deal': return this.client.crm.deals;
      case 'company': return this.client.crm.companies;
      case 'contact': return this.client.crm.contacts;
    }
  }

  async downloadAllEntities() {
    let associations: undefined | string[];
    if (this.associations.length > 0) {
      associations = this.associations.map(a => a[1]);
    }
    const data = await this.api().getAll(undefined, undefined, this.apiProperties, associations);
    const entities = data.map(raw => {
      const props = this.fromAPI(raw.properties);
      const entity = new this.Entity(raw.id, props);

      // for (const [container, other] of this.associations) {
      //   entity[container];
      // }

      return entity;
    });
    this.entities = entities;
  }

  async syncUpAllEntities() {
    const toSync = this.entities.filter(e => e.hasChanges());
    const toCreate = toSync.filter(e => e.id === undefined);
    const toUpdate = toSync.filter(e => e.id !== undefined);

    if (toCreate.length > 0) {
      const groups = batchesOf(toCreate, 10);
      for (const entities of groups) {
        const results = await this.api().batchApi.create({
          inputs: entities.map(e => {
            const properties = this.getChangedProperties(e);
            e.applyUpdates();

            return { properties };
          })
        });
      }
    }

    if (toUpdate.length > 0) {
      const groups = batchesOf(toUpdate, 10);
      for (const entities of groups) {
        const results = await this.api().batchApi.update({
          inputs: entities.map(e => {
            const id = e.id;
            assert.ok(id);

            const properties = this.getChangedProperties(e);
            e.applyUpdates();

            return { id, properties };
          })
        });
      }
    }
  }

  private getChangedProperties(e: E) {
    const properties: { [key: string]: string } = {};
    for (const [k, v] of Object.entries(e.getChanges())) {
      const fn = this.toAPI[k];
      const [newKey, newVal] = fn(v);
      properties[newKey] = newVal;
    }
    return properties;
  }

}
