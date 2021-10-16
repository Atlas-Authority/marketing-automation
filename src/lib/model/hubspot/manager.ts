import * as hubspot from '@hubspot/api-client';
import * as assert from 'assert';
import { batchesOf } from '../../util/helpers.js';
import { HubspotEntity, HubspotEntityKind } from "./entity.js";

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

export type HubspotPropertyTransformers<T> = {
  [P in keyof T]: (prop: T[P]) => [string, string]
};

type HubspotAssociateFunction = (entity: HubspotEntity<any>) => void;

export abstract class HubspotEntityManager<
  P extends { [key: string]: any },
  E extends HubspotEntity<P>,
  I extends HubspotInputObject>
{

  constructor(private client: hubspot.Client) { }

  protected abstract Entity: new (id: string | null, props: P) => E;
  protected abstract kind: HubspotEntityKind;
  protected abstract associations: HubspotEntityKind[];

  protected abstract apiProperties: string[];
  protected abstract fromAPI(data: I['properties']): P | null;
  protected abstract toAPI: HubspotPropertyTransformers<P>;

  protected abstract identifiers: (keyof P)[];

  protected entities = new Map<string, E>();

  private api() {
    switch (this.kind) {
      case 'deal': return this.client.crm.deals;
      case 'company': return this.client.crm.companies;
      case 'contact': return this.client.crm.contacts;
    }
  }

  public async downloadAllEntities() {
    let inputAssociations = ((this.associations.length > 0)
      ? this.associations
      : undefined);
    const data = await this.api().getAll(undefined, undefined, this.apiProperties, inputAssociations);

    /** Find entity based on kind and id, and when you have it, give it to me. */
    const associators: [HubspotEntityKind, string, HubspotAssociateFunction][] = [];

    for (const raw of data) {
      const props = this.fromAPI(raw.properties);
      if (!props) continue;

      const entity = new this.Entity(raw.id, props);
      assert.ok(entity.id);

      for (const [, { results: list }] of Object.entries(raw.associations || {})) {
        for (const item of list) {
          const prefix = `${this.kind}_to_`;
          assert.ok(item.type.startsWith(prefix));
          const otherKind = item.type.substr(prefix.length) as HubspotEntityKind;

          associators.push([otherKind, item.id, (otherEntity) => {
            entity._addRawAssociation(otherKind, otherEntity);
          }]);
        }
      }

      this.entities.set(entity.id, entity);
    }

    return associators;
  }

  public get(id: string) {
    return this.entities.get(id);
  }

  public async syncUpAllEntities() {
    const toSync = [...this.entities.values()].filter(e => e.hasPropertyChanges());
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
          this.entities.set(found.id, e);
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
    for (const [k, v] of Object.entries(e.getPropertyChanges())) {
      const fn = this.toAPI[k];
      const [newKey, newVal] = fn(v);
      properties[newKey] = newVal;
    }
    return properties;
  }

}
