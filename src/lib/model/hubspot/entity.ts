import * as assert from 'assert';
import { EntityKind } from './interfaces.js';

export interface Indexer<D> {
  removeIndexesFor<K extends keyof D>(key: K, val: D[K] | undefined): void;
  addIndexesFor<K extends keyof D>(key: K, val: D[K] | undefined, entity: Entity<D>): void;
}

export abstract class Entity<D extends { [key: string]: any }> {

  id?: string;

  /** The most recently saved props, or all unsaved props */
  private _data: D;
  /** Contains only new changes, and only when an entity is saved */
  private newData: Partial<D> = {};

  /** The associations this was created with, whether an existing or new entity */
  private assocs = new Set<Entity<any>>();
  /** A copy of assocs, which all updates act on, whether an existing or new entity */
  private newAssocs = new Set<Entity<any>>();

  readonly data: D;

  constructor(
    id: string | null,
    public kind: EntityKind,
    data: D,
    private indexer: Indexer<D>,
  ) {
    if (id) this.id = id;
    this._data = data;

    type K = keyof D;
    this.data = new Proxy(data, {
      get: (_target, _key) => {
        return this.get(_key as K);
      },
      set: (_target, _key, _val) => {
        this.set(_key as K, _val as D[K]);
        return true;
      },
    });
  }

  guaranteedId() {
    assert.ok(this.id);
    return this.id;
  }

  // Properties

  get<K extends keyof D>(key: K) {
    if (this.id === undefined) return this._data[key];
    if (key in this.newData) return this.newData[key];
    return this._data[key];
  }

  set<K extends keyof D>(key: K, val: D[K]) {
    if (this.pseudoProperties.includes(key)) return;

    if (this.id === undefined) {
      this.indexer.removeIndexesFor(key, this._data[key]);
      this._data[key] = val;
      this.indexer.addIndexesFor(key, this._data[key], this);
      return;
    }

    this.indexer.removeIndexesFor(key, this.newData[key]);
    const oldVal = this._data[key];
    if (oldVal === val) {
      delete this.newData[key];
    }
    else {
      this.newData[key] = val;
    }
    this.indexer.addIndexesFor(key, this.newData[key], this);
  }

  hasPropertyChanges() {
    return this.id === undefined || Object.keys(this.newData).length > 0;
  }

  getPropertyChanges() {
    if (this.id === undefined) return this._data;
    return this.newData;
  }

  applyPropertyChanges() {
    Object.assign(this._data, this.newData);
    this.newData = {};
  }

  abstract pseudoProperties: (keyof D)[];

  // Associations

  protected makeDynamicAssociation<T extends Entity<any>>(kind: EntityKind) {
    return {
      getAll: () => this.getAssociations(kind) as T[],
      has: (entity: T) => this.hasAssociation(entity),
      add: (entity: T) => this.addAssociation(entity, { firstSide: true, initial: false }),
      remove: (entity: T) => this.removeAssociation(entity, { firstSide: true }),
      clear: () => this.clearAssociations(kind),
    };
  }

  /** Don't use directly; use deal.contacts.add(c) etc. */
  addAssociation(entity: Entity<any>, meta: { firstSide: boolean, initial: boolean }) {
    if (meta.initial) this.assocs.add(entity);
    this.newAssocs.add(entity);

    if (meta.firstSide) entity.addAssociation(this, { firstSide: false, initial: meta.initial });
  }

  private removeAssociation(entity: Entity<any>, meta: { firstSide: boolean }) {
    this.newAssocs.delete(entity);

    if (meta.firstSide) entity.removeAssociation(this, { firstSide: false });
  }

  private hasAssociation(entity: Entity<any>) {
    return this.newAssocs.has(entity);
  }

  private getAssociations(kind: EntityKind) {
    return [...this.newAssocs].filter(e => e.kind === kind);
  }

  private clearAssociations(kind: EntityKind) {
    for (const e of this.newAssocs) {
      if (e.kind === kind) {
        this.newAssocs.delete(e);
      }
    }
  }

  hasAssociationChanges() {
    return (
      [...this.assocs].some(e => !this.newAssocs.has(e)) ||
      [...this.newAssocs].some(e => !this.assocs.has(e))
    );
  }

  getAssociationChanges() {
    const toAdd = [...this.newAssocs].filter(e => !this.assocs.has(e));
    const toDel = [...this.assocs].filter(e => !this.newAssocs.has(e));
    return [
      ...toAdd.map(e => ({ op: 'add', other: e })),
      ...toDel.map(e => ({ op: 'del', other: e })),
    ] as { op: 'add' | 'del', other: Entity<any> }[];
  }

  applyAssociationChanges() {
    this.assocs = new Set(this.newAssocs);
  }

}
