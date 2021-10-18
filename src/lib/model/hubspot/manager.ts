import * as hubspot from '@hubspot/api-client';
import * as assert from 'assert';
import { batchesOf } from '../../util/helpers.js';
import { EntityDatabase, HubspotAssociationString, HubspotEntity, HubspotEntityKind } from "./entity.js";

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

export abstract class HubspotEntityManager<
  P extends { [key: string]: any },
  E extends HubspotEntity<P>,
  I extends HubspotInputObject>
{

  constructor(private client: hubspot.Client, private db: EntityDatabase) { }

  protected abstract Entity: new (db: EntityDatabase, id: string | null, props: P, associations: Set<HubspotAssociationString>) => E;
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

    for (const raw of data) {
      const props = this.fromAPI(raw.properties);
      if (!props) continue;

      const associations = new Set<HubspotAssociationString>();
      for (const [, { results: list }] of Object.entries(raw.associations || {})) {
        for (const item of list) {
          const prefix = `${this.kind}_to_`;
          assert.ok(item.type.startsWith(prefix));
          const otherKind = item.type.substr(prefix.length) as HubspotEntityKind;
          associations.add(`${otherKind}_${item.id}`);
        }
      }

      const entity = new this.Entity(this.db, raw.id, props, associations);
      this.entities.set(entity.guaranteedId(), entity);
    }
  }

  public get(id: string) {
    return this.entities.get(id);
  }

  public async syncUpAllEntities() {
    this.syncUpAllEntitiesProperties();
    this.syncUpAllEntitiesAssociations();
  }

  private async syncUpAllEntitiesProperties() {
    const toSync = [...this.entities.values()].filter(e => e.hasPropertyChanges());
    const toCreate = toSync.filter(e => e.id === undefined);
    const toUpdate = toSync.filter(e => e.id !== undefined);

    if (toCreate.length > 0) {
      const groupsToCreate = batchesOf(toCreate, 10);
      for (const entitiesToCreate of groupsToCreate) {
        const results = await this.api().batchApi.create({
          inputs: entitiesToCreate.map(e => ({ properties: this.getChangedProperties(e) }))
        });

        for (const e of entitiesToCreate) {
          e.applyUpdates();
        }

        for (const e of entitiesToCreate) {
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
      const groupsToUpdate = batchesOf(toUpdate, 10);
      for (const entitiesToUpdate of groupsToUpdate) {
        const results = await this.api().batchApi.update({
          inputs: entitiesToUpdate.map(e => ({
            id: e.guaranteedId(),
            properties: this.getChangedProperties(e),
          }))
        });

        for (const e of entitiesToUpdate) {
          e.applyUpdates();
        }
      }
    }
  }

  private async syncUpAllEntitiesAssociations() {
    const toSync = ([...this.entities.values()]
      .filter(e => e.hasAssociationChanges())
      .flatMap(e => e.getAssociationChanges()
        .map(changes => ({ e, ...changes }))));

    for (const otherKind of this.associations) {
      const toSyncInKind = (toSync
        .filter(changes => changes.kind === otherKind)
        .map(changes => ({
          ...changes,
          inputs: {
            from: { id: changes.e.guaranteedId() },
            to: { id: changes.id },
            type: `${this.kind}_${otherKind}`,
          }
        })));

      const toAdd = toSyncInKind.filter(changes => changes.op === 'add');
      const toDel = toSyncInKind.filter(changes => changes.op === 'del');

      for (const toAddSubset of batchesOf(toAdd, 100)) {
        await this.client.crm.associations.batchApi.create(
          this.kind,
          otherKind,
          { inputs: toAddSubset.map(changes => changes.inputs) },
        );
      }

      for (const toDelSubset of batchesOf(toDel, 100)) {
        await this.client.crm.associations.batchApi.archive(
          this.kind,
          otherKind,
          { inputs: toDelSubset.map(changes => changes.inputs) },
        );
      }
    }

    for (const changes of toSync) {
      changes.e.applyAssociationChanges();
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
