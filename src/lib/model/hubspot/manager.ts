import * as assert from 'assert';
import { Downloader, Progress } from '../../io/downloader/downloader.js';
import { EntityKind, RelativeAssociation } from '../../io/hubspot.js';
import { Uploader } from '../../io/uploader/uploader.js';
import { batchesOf } from '../../util/helpers.js';
import { Entity, EntityDatabase } from "./entity.js";

export type PropertyTransformers<T> = {
  [P in keyof T]: (prop: T[P]) => [string, string]
};

export abstract class EntityManager<
  P extends { [key: string]: any },
  E extends Entity<P>>
{

  constructor(
    private downloader: Downloader,
    private uploader: Uploader,
    private db: EntityDatabase
  ) { }

  protected abstract Entity: new (db: EntityDatabase, id: string | null, props: P, associations: Set<RelativeAssociation>) => E;
  protected abstract kind: EntityKind;
  protected abstract associations: EntityKind[];

  protected abstract apiProperties: string[];
  protected abstract fromAPI(data: { [key: string]: string | null }): P | null;
  protected abstract toAPI: PropertyTransformers<P>;

  public abstract addIndexes(entities: Iterable<E>): void;

  protected abstract identifiers: (keyof P)[];

  protected entities = new Map<string, E>();

  public async downloadAllEntities(progress: Progress) {
    const data = await this.downloader.downloadHubspotEntities(progress, this.kind, this.apiProperties, this.associations);

    for (const raw of data) {
      const props = this.fromAPI(raw.properties);
      if (!props) continue;

      const associations = new Set<RelativeAssociation>();
      for (const item of raw.associations) {
        associations.add(item);
      }

      const entity = new this.Entity(this.db, raw.id, props, associations);
      this.entities.set(entity.guaranteedId(), entity);
    }

    this.addIndexes(this.entities.values());
  }

  public create(props: P) {
    const e = new this.Entity(this.db, null, props, new Set());
    this.addIndexes([e]);
    return e;
  }

  public get(id: string) {
    return this.entities.get(id);
  }

  public getAll() {
    return this.entities.values();
  }

  public getArray() {
    return [...this.entities.values()];
  }

  public async syncUpAllEntities() {
    await this.syncUpAllEntitiesProperties();
    await this.syncUpAllEntitiesAssociations();
    this.addIndexes(this.entities.values());
  }

  private async syncUpAllEntitiesProperties() {
    const toSync = this.getArray().filter(e => e.hasPropertyChanges());
    const toCreate = toSync.filter(e => e.id === undefined);
    const toUpdate = toSync.filter(e => e.id !== undefined);

    if (toCreate.length > 0) {
      const amount = this.kind === 'contact' ? 10 : 100;
      const groupsToCreate = batchesOf(toCreate, amount);
      for (const entitiesToCreate of groupsToCreate) {
        const results = await this.uploader.createHubspotEntities(
          this.kind,
          entitiesToCreate.map(e => ({
            properties: this.getChangedProperties(e),
          }))
        );

        for (const e of entitiesToCreate) {
          e.applyPropertyChanges();
        }

        for (const e of entitiesToCreate) {
          const found = results.find(result => {
            for (const localIdKey of this.identifiers) {
              const localVal = e.data[localIdKey];
              assert.ok(localVal);
              const [remoteIdKey, hsLocal] = this.toAPI[localIdKey](localVal);
              const hsRemote = result.properties[remoteIdKey];
              if (hsLocal !== hsRemote) return false;
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
      const groupsToUpdate = batchesOf(toUpdate, 100);
      for (const entitiesToUpdate of groupsToUpdate) {
        const results = await this.uploader.updateHubspotEntities(
          this.kind,
          entitiesToUpdate.map(e => ({
            id: e.guaranteedId(),
            properties: this.getChangedProperties(e),
          }))
        );

        for (const e of entitiesToUpdate) {
          e.applyPropertyChanges();
        }
      }
    }
  }

  private async syncUpAllEntitiesAssociations() {
    const toSync = (this.getArray()
      .filter(e => e.hasAssociationChanges())
      .flatMap(e => e.getAssociationChanges()
        .map(changes => ({ e, ...changes }))));

    for (const otherKind of this.associations) {
      const toSyncInKind = (toSync
        .filter(changes => changes.kind === otherKind)
        .map(changes => ({
          ...changes,
          inputs: {
            fromId: changes.e.guaranteedId(),
            toId: changes.id,
            toType: otherKind,
          }
        })));

      const toAdd = toSyncInKind.filter(changes => changes.op === 'add');
      const toDel = toSyncInKind.filter(changes => changes.op === 'del');

      for (const toAddSubset of batchesOf(toAdd, 100)) {
        await this.uploader.createHubspotAssociations(
          this.kind,
          otherKind,
          toAddSubset.map(changes => changes.inputs),
        );
      }

      for (const toDelSubset of batchesOf(toDel, 100)) {
        await this.uploader.deleteHubspotAssociations(
          this.kind,
          otherKind,
          toDelSubset.map(changes => changes.inputs),
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
