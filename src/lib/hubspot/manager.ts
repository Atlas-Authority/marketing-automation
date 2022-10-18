import { isPresent } from '../util/helpers';
import { Entity, Indexer } from './entity';
import { EntityAdapter, EntityKind, FullEntity, RelativeAssociation } from './interfaces';

export abstract class EntityManager<
  D extends Record<string, any>,
  E extends Entity<D>>
{

  protected abstract Entity: new (id: string | null, adapter: EntityAdapter<D>, downloadedData: Record<string, string>, data: D, indexer: Indexer<D>) => E;
  public abstract entityAdapter: EntityAdapter<D>;
  protected get kind(): EntityKind { return this.entityAdapter.kind; }

  private entities: E[] = [];
  private indexes: Index<E>[] = [];
  private indexIndex = new Map<keyof D, Index<E>>();
  public get = this.makeIndex(e => [e.id].filter(isPresent), []);

  public constructor(
    private typeMappings: Map<string, string>,
  ) { }

  public importEntities(rawEntities: readonly FullEntity[]) {
    const prelinkedAssociations = new Map<string, Set<RelativeAssociation>>();

    for (const rawEntity of rawEntities) {
      if (this.entityAdapter.shouldReject?.(rawEntity.properties)) continue;

      const data = mapObject(this.entityAdapter.data, spec => {
        const remoteValue = spec.property ? rawEntity.properties[spec.property] : null;
        return spec.down(remoteValue);
      }) as D;

      for (const item of rawEntity.associations) {
        let set = prelinkedAssociations.get(rawEntity.id);
        if (!set) prelinkedAssociations.set(rawEntity.id, set = new Set());
        set.add(item);
      }

      const entity = new this.Entity(rawEntity.id, this.entityAdapter, rawEntity.properties, data, this);
      this.entities.push(entity);
    }

    for (const index of this.indexes) {
      index.clear();
      index.addIndexesFor(this.entities);
    }

    return prelinkedAssociations;
  }

  public linkEntities(
    prelinkedAssociations: Map<string, Set<RelativeAssociation>>,
    managers: {
      [K in `${EntityKind}Manager`]: EntityManager<any, any>;
    },
  ) {
    const toKinds = new Set<EntityKind>(['company', 'contact', 'deal']);

    for (const [meId, rawAssocs] of prelinkedAssociations) {
      for (const rawAssoc of rawAssocs) {
        const me = this.get(meId);
        if (!me) throw new Error(`Couldn't find kind=${this.kind} id=${meId}`);

        const [toKindRaw, youId] = rawAssoc.split(':') as [string, string];
        let toKind = toKindRaw.replace(/_unlabeled$/, '');

        let otherKind: EntityKind;
        if (toKinds.has(toKind as any)) {
          otherKind = toKind as any;
        }
        else {
          if (!toKind.includes('_to_')) {
            const mappedType = this.typeMappings.get(toKind);
            if (mappedType) {
              toKind = mappedType;
            }
            else {
              throw new Error(`Unknown association type "${toKind}" for ${me.kind}:${meId} to ${youId}`);
            }
          }

          const bothKinds = new Set(toKind.split('_to_') as EntityKind[]);
          bothKinds.delete(me.kind);
          otherKind = [...bothKinds][0];
        }

        const you = managers[`${otherKind}Manager`].get(youId);
        if (!you) throw new Error(`Couldn't find kind=${toKindRaw} id=${youId}`);

        me.addAssociation(you, { firstSide: true, initial: true });
      }
    }
  }

  public create(data: D) {
    const e = new this.Entity(null, this.entityAdapter, {}, data, this);
    this.entities.push(e);
    for (const index of this.indexes) {
      index.addIndexesFor([e]);
    }
    return e;
  }

  public getAll(): Iterable<E> {
    return this.entities;
  }

  public getArray(): E[] {
    return this.entities;
  }

  protected makeIndex(keysFor: (e: E) => string[], deps: (keyof D)[]): (key: string) => E | undefined {
    const index = new Index(keysFor);
    this.indexes.push(index);
    for (const depKey of deps) {
      this.indexIndex.set(depKey, index);
    }
    return index.get.bind(index);
  }

  public removeIndexesFor<K extends keyof D>(depKey: K, entity: E) {
    this.indexIndex.get(depKey)?.removeIndexesFor([entity]);
  }

  public addIndexesFor<K extends keyof D>(depKey: K, val: D[K] | undefined, entity: E) {
    if (!val) return;
    this.indexIndex.get(depKey)?.addIndexesFor([entity]);
  }

}

class Index<E extends Entity<any>> {

  private map = new Map<string, E>();
  public constructor(private keysFor: (e: E) => string[]) { }

  public clear() {
    this.map.clear();
  }

  public addIndex(key: string, entity: E) {
    this.map.set(key, entity);
  }

  public removeIndex(key: string) {
    this.map.delete(key);
  }

  public addIndexesFor(entities: Iterable<E>) {
    for (const e of entities) {
      for (const key of this.keysFor(e)) {
        this.addIndex(key, e);
      }
    }
  }

  public removeIndexesFor(entities: Iterable<E>) {
    for (const e of entities) {
      for (const key of this.keysFor(e)) {
        this.removeIndex(key);
      }
    }
  }

  public get(key: string) {
    return this.map.get(key);
  }

}

function mapObject<T extends Record<string, any>, K extends keyof T, O>(o: T, fn: (e: T[K]) => O): { [K in keyof T]: O } {
  const mapped = typedEntries(o).map(([k, v]) => [k, fn(v as T[K])]);
  return Object.fromEntries(mapped);
}

export function typedEntries<T extends Record<string, any>, K extends keyof T>(o: T) {
  return Object.entries(o) as [K, T[K]][];
}
