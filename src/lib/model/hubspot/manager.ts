import * as assert from 'assert';
import { HubspotService, Progress } from '../../io/interfaces.js';
import { AttachableError } from '../../util/errors.js';
import { isPresent } from '../../util/helpers.js';
import { Entity, Indexer } from "./entity.js";
import { EntityKind, HubspotProperties, RelativeAssociation } from './interfaces.js';

export interface EntityDatabase {
  getEntity(kind: EntityKind, id: string): Entity<any, any>;
}

export interface EntityAdapter<D, C> {
  associations: [EntityKind, 'down' | 'down/up'][];

  shouldReject?: (data: HubspotProperties) => boolean;

  data: { [K in keyof D]: {
    property: string | undefined,
    down: (data: HubspotProperties) => D[K],
  } };

  toAPI: PropertyTransformers<D>;

  computed: { [K in keyof C]: {
    default: C[K],
    down: (data: HubspotProperties) => C[K],
    properties: string[],
  } },

  identifiers: (keyof D)[];
}

export type PropertyTransformers<T> = {
  [K in keyof T]: (prop: T[K]) => [string, string]
};

export abstract class EntityManager<
  D extends Record<string, any>,
  C extends Record<string, any>,
  E extends Entity<D, C>>
{

  static readonly noUpSync = (): [string, string] => ['', ''];

  static upSyncIfConfigured<T>(
    attributeKey: string | undefined,
    transformer: (localValue: T) => string
  ): (val: T) => [string, string] {
    return (attributeKey ?
      (value => [attributeKey, transformer(value)])
      : this.noUpSync);
  }

  constructor(
    private downloader: HubspotService,
    private uploader: HubspotService,
    private db: EntityDatabase
  ) { }

  public createdCount = 0;
  public updatedCount = 0;
  public associatedCount = 0;
  public disassociatedCount = 0;

  protected abstract Entity: new (id: string | null, kind: EntityKind, data: D, computed: C, indexer: Indexer<D>) => E;
  protected abstract kind: EntityKind;
  protected abstract entityAdapter: EntityAdapter<D, C>;

  private entities: E[] = [];
  private indexes: Index<E>[] = [];
  private indexIndex = new Map<keyof D, Index<E>>();
  public get = this.makeIndex(e => [e.id].filter(isPresent), []);

  private prelinkedAssociations = new Map<string, Set<RelativeAssociation>>();

  public async downloadAllEntities(progress: Progress) {
    const downAssociations = (this.entityAdapter.associations
      .filter(([kind, dir]) => dir.includes('down'))
      .map(([kind, dir]) => kind));

    const apiProperties = [
      ...typedEntries(this.entityAdapter.data).map(([k, v]) => v.property).filter(isPresent),
      ...typedEntries(this.entityAdapter.computed).flatMap(([k, v]) => v.properties),
    ];

    const rawEntities = await this.downloader.downloadEntities(progress, this.kind, apiProperties, downAssociations);

    for (const rawEntity of rawEntities) {
      if (this.entityAdapter.shouldReject?.(rawEntity.properties)) continue;

      const data = Object.fromEntries(typedEntries(this.entityAdapter.data).map(([k, v]) => [k, v.down(rawEntity.properties)])) as D;
      const computed = mapObject(this.entityAdapter.computed, (key, spec) => spec.down(rawEntity.properties)) as C;

      for (const item of rawEntity.associations) {
        let set = this.prelinkedAssociations.get(rawEntity.id);
        if (!set) this.prelinkedAssociations.set(rawEntity.id, set = new Set());
        set.add(item);
      }

      const entity = new this.Entity(rawEntity.id, this.kind, data, computed, this);
      this.entities.push(entity);
    }

    for (const index of this.indexes) {
      index.clear();
      index.addIndexesFor(this.entities);
    }
  }

  public linkAssociations() {
    for (const [meId, rawAssocs] of this.prelinkedAssociations) {
      for (const rawAssoc of rawAssocs) {
        const me = this.get(meId);
        if (!me) throw new Error(`Couldn't find kind=${this.kind} id=${meId}`);

        const { toKind, youId } = this.getAssocInfo(rawAssoc);
        const you = this.db.getEntity(toKind, youId);
        if (!you) throw new Error(`Couldn't find kind=${toKind} id=${youId}`);

        me.addAssociation(you, { firstSide: true, initial: true });
      }
    }
    this.prelinkedAssociations.clear();
  }

  private getAssocInfo(a: RelativeAssociation) {
    const [kind, id] = a.split(':');
    return { toKind: kind as EntityKind, youId: id };
  }

  public create(data: D) {
    const computed = mapObject(this.entityAdapter.computed, (key, spec) => spec.default) as C;
    const e = new this.Entity(null, this.kind, data, computed, this);
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

    if (toCreate.length > 0) {
      const results = await this.uploader.createEntities(
        this.kind,
        toCreate.map(e => ({
          properties: this.getChangedProperties(e),
        }))
      );

      for (const e of toCreate) {
        e.applyPropertyChanges();
      }

      for (const e of toCreate) {
        const found = results.find(result => {
          for (const localIdKey of this.entityAdapter.identifiers) {
            const localVal = e.data[localIdKey];
            const [remoteIdKey, hsLocal] = this.entityAdapter.toAPI[localIdKey](localVal);
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

    if (toUpdate.length > 0) {
      const results = await this.uploader.updateEntities(
        this.kind,
        toUpdate.map(e => ({
          id: e.guaranteedId(),
          properties: this.getChangedProperties(e),
        }))
      );

      for (const e of toUpdate) {
        e.applyPropertyChanges();
      }
    }

    this.createdCount += toCreate.length;
    this.updatedCount += toUpdate.length;
  }

  private async syncUpAllEntitiesAssociations() {
    const toSync = (this.entities
      .filter(e => e.hasAssociationChanges())
      .flatMap(e => e.getAssociationChanges()
        .map(({ op, other }) => ({ op, from: e, to: other }))));

    const upAssociations = (this.entityAdapter.associations
      .filter(([kind, dir]) => dir.includes('up'))
      .map(([kind, dir]) => kind));

    for (const otherKind of upAssociations) {
      const toSyncInKind = (toSync
        .filter(changes => changes.to.kind === otherKind)
        .map(changes => ({
          ...changes,
          inputs: {
            fromId: changes.from.guaranteedId(),
            toId: changes.to.guaranteedId(),
            toType: otherKind,
          }
        })));

      const toAdd = toSyncInKind.filter(changes => changes.op === 'add');
      const toDel = toSyncInKind.filter(changes => changes.op === 'del');

      await this.uploader.createAssociations(
        this.kind,
        otherKind,
        toAdd.map(changes => changes.inputs),
      );

      await this.uploader.deleteAssociations(
        this.kind,
        otherKind,
        toDel.map(changes => changes.inputs),
      );

      this.associatedCount += toAdd.length;
      this.disassociatedCount += toDel.length;
    }

    for (const changes of toSync) {
      changes.from.applyAssociationChanges();
    }
  }

  private getChangedProperties(e: E) {
    const properties: Record<string, string> = {};
    for (const [k, v] of Object.entries(e.getPropertyChanges())) {
      const fn = this.entityAdapter.toAPI[k];
      const [newKey, newVal] = fn(v);
      if (newKey) properties[newKey] = newVal;
    }
    return properties;
  }

  protected makeIndex(keysFor: (e: E) => string[], deps: (keyof D)[]): (key: string) => E | undefined {
    const index = new Index(keysFor);
    this.indexes.push(index);
    for (const depKey of deps) {
      this.indexIndex.set(depKey, index);
    }
    return index.get.bind(index);
  }

  removeIndexesFor<K extends keyof D>(key: K, val: D[K] | undefined) {
    if (!val) return;
    this.indexIndex.get(key)?.removeIndex(val);
  }

  addIndexesFor<K extends keyof D>(key: K, val: D[K] | undefined, entity: E) {
    if (!val) return;
    this.indexIndex.get(key)?.addIndex(val, entity);
  }

}

class Index<E> {

  private map = new Map<string, E>();
  constructor(private keysFor: (e: E) => string[]) { }

  clear() {
    this.map.clear();
  }

  addIndex(key: string, entity: E) {
    this.map.set(key, entity);
  }

  removeIndex(key: string) {
    this.map.delete(key);
  }

  addIndexesFor(entities: Iterable<E>) {
    for (const e of entities) {
      for (const key of this.keysFor(e)) {
        this.addIndex(key, e);
      }
    }
  }

  removeIndexesFor(entities: Iterable<E>) {
    for (const e of entities) {
      for (const key of this.keysFor(e)) {
        this.removeIndex(key);
      }
    }
  }

  get(key: string) {
    return this.map.get(key);
  }

}

function mapObject<T, K extends keyof T, O>(o: T, fn: (key: K, e: T[K]) => O): { [K in keyof T]: O } {
  const mapped = typedEntries(o).map(([k, v]) => [k, fn(k as K, v as T[K])]);
  return Object.fromEntries(mapped);
}

function typedEntries<T, K extends keyof T, O>(o: T) {
  return Object.entries(o) as [K, T[K]][];
}
