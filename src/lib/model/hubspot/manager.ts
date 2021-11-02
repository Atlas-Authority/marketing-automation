import * as assert from 'assert';
import { Downloader, Progress, Uploader } from '../../io/interfaces.js';
import { AttachableError } from '../../util/errors.js';
import { batchesOf } from '../../util/helpers.js';
import { Entity, EntityDatabase } from "./entity.js";
import { EntityKind, RelativeAssociation } from './interfaces.js';

export type PropertyTransformers<T> = {
  [P in keyof T]: (prop: T[P]) => [string, string]
};

export abstract class EntityManager<
  P extends { [key: string]: any },
  E extends Entity<P>>
{

  protected static readonly noUpSync = (): [string, string] => ['', ''];

  protected static upSyncIfConfigured<T>(
    attributeKey: string | undefined,
    transformer: (localValue: T) => string
  ): (val: T) => [string, string] {
    return (attributeKey ?
      (value => [attributeKey, transformer(value)])
      : this.noUpSync);
  }

  constructor(
    private downloader: Downloader,
    private uploader: Uploader,
    private db: EntityDatabase
  ) { }

  public createdCount = 0;
  public updatedCount = 0;

  protected abstract Entity: new (db: EntityDatabase, id: string | null, props: P, associations: Set<RelativeAssociation>) => E;
  protected abstract kind: EntityKind;
  protected abstract associations: EntityKind[];

  protected abstract apiProperties: string[];
  protected abstract fromAPI(data: { [key: string]: string | null }): P | null;
  protected abstract toAPI: PropertyTransformers<P>;

  protected abstract identifiers: (keyof P)[];

  private entities: E[] = [];
  private indexes: Index<E>[] = [];
  private entitiesById = this.makeIndex(e => e.id ? [e.id] : []);

  public async downloadAllEntities(progress: Progress) {
    const data = await this.downloader.downloadEntities(progress, this.kind, this.apiProperties, this.associations);

    for (const raw of data) {
      const props = this.fromAPI(raw.properties);
      if (!props) continue;

      const associations = new Set<RelativeAssociation>();
      for (const item of raw.associations) {
        associations.add(item);
      }

      const entity = new this.Entity(this.db, raw.id, props, associations);
      this.entities.push(entity);
    }

    for (const index of this.indexes) {
      index.clear();
      index.addIndexesFor(this.entities);
    }
  }

  public create(props: P) {
    const e = new this.Entity(this.db, null, props, new Set());
    this.entities.push(e);
    for (const index of this.indexes) {
      index.addIndexesFor([e]);
    }
    return e;
  }

  public removeLocally(entities: Iterable<E>) {
    for (const index of this.indexes) {
      index.removeIndexesFor(entities);
    }
    for (const e of entities) {
      const idx = this.entities.indexOf(e);
      this.entities.splice(idx, 1);
    }
  }

  public get(id: string) {
    return this.entitiesById.get(id);
  }

  public getAll(): Iterable<E> {
    return this.entities;
  }

  public getArray(): E[] {
    return this.entities;
  }

  public async syncUpAllEntities() {
    await this.syncUpAllEntitiesProperties();
    await this.syncUpAllEntitiesAssociations();
    for (const index of this.indexes) {
      index.clear();
      index.addIndexesFor(this.entities);
    }
  }

  private async syncUpAllEntitiesProperties() {
    const toSync = this.entities.filter(e => e.hasPropertyChanges());
    const toCreate = toSync.filter(e => e.id === undefined);
    const toUpdate = toSync.filter(e => e.id !== undefined);

    const batchSize = this.kind === 'contact' ? 10 : 100;

    if (toCreate.length > 0) {
      const groupsToCreate = batchesOf(toCreate, batchSize);
      for (const entitiesToCreate of groupsToCreate) {
        const results = await this.uploader.createEntities(
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
              const [remoteIdKey, hsLocal] = this.toAPI[localIdKey](localVal);
              const hsRemote = result.properties[remoteIdKey] ?? '';
              if (hsLocal !== hsRemote) return false;
            }
            return true;
          });

          if (!found) {
            throw new AttachableError("Couldn't find ", JSON.stringify({
              local: e.data,
              remotes: results.map(r => ({
                id: r.id,
                properties: r.properties,
              })),
            }, null, 2));
          }

          assert.ok(found);
          e.id = found.id;
        }
      }
    }

    if (toUpdate.length > 0) {
      const groupsToUpdate = batchesOf(toUpdate, batchSize);
      for (const entitiesToUpdate of groupsToUpdate) {
        const results = await this.uploader.updateEntities(
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

    this.createdCount += toCreate.length;
    this.updatedCount += toUpdate.length;
  }

  private async syncUpAllEntitiesAssociations() {
    const toSync = (this.entities
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
        await this.uploader.createAssociations(
          this.kind,
          otherKind,
          toAddSubset.map(changes => changes.inputs),
        );
      }

      for (const toDelSubset of batchesOf(toDel, 100)) {
        await this.uploader.deleteAssociations(
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
      if (newKey) properties[newKey] = newVal;
    }
    return properties;
  }

  protected makeIndex(keysFor: (e: E) => string[]): ReadonlyIndex<E> {
    const index = new Index(keysFor);
    this.indexes.push(index);
    return index;
  }

}

type ReadonlyIndex<T> = Pick<Index<T>, 'get' | 'delete'>;

class Index<E> {

  private map = new Map<string, E>();
  constructor(private keysFor: (e: E) => string[]) { }

  clear() {
    this.map.clear();
  }

  addIndexesFor(entities: Iterable<E>) {
    for (const e of entities) {
      for (const key of this.keysFor(e)) {
        this.map.set(key, e);
      }
    }
  }

  removeIndexesFor(entities: Iterable<E>) {
    for (const e of entities) {
      for (const key of this.keysFor(e)) {
        this.map.delete(key);
      }
    }
  }

  get(key: string) {
    return this.map.get(key);
  }

  delete(key: string) {
    return this.map.delete(key);
  }

}
