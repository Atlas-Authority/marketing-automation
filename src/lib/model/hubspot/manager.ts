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

  protected abstract Entity: new (id: string | null, props: P) => E;
  protected abstract kind: HubspotEntityKind;
  protected abstract associations: [keyof E, HubspotEntityKind][];

  protected abstract apiProperties: string[];
  protected abstract fromAPI(data: I['properties']): P;
  protected abstract toAPI: HubspotPropertyTransformers<P>;

  protected abstract identifiers: (keyof P)[];

  protected entities: E[] = [];

  private api() {
    switch (this.kind) {
      case 'deal': return this.client.crm.deals;
      case 'company': return this.client.crm.companies;
      case 'contact': return this.client.crm.contacts;
    }
  }

  public async downloadAllEntities() {
    let associations: undefined | string[];
    if (this.associations.length > 0) {
      associations = this.associations.map(a => a[1]);
    }
    const data = await this.api().getAll(undefined, undefined, this.apiProperties, associations);
    const entities = data.map(raw => {
      const props = this.fromAPI(raw.properties);
      const entity = new this.Entity(raw.id, props);

      // raw.associations
      // for (const [container, other] of this.associations) {
      //   entity[container].push();
      // }

      return entity;
    });
    this.entities = entities;
  }

  public async syncUpAllEntities() {
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

        for (const e of entities) {
          const found = results.body.results.find(result => {
            for (const localKey of this.identifiers) {
              const localVal = e.get(localKey);
              assert.ok(localVal);
              const [remoteKey, abnormalized] = this.toAPI[localKey](localVal);
              if (abnormalized !== result.properties[remoteKey]) return false;
            }
            return true;
          });

          assert.ok(found);
          e.id = found.id;
        }
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
