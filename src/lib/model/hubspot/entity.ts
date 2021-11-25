import { EntityKind } from './interfaces.js';

export interface Indexer<D> {
  removeIndexesFor<K extends keyof D>(key: K, val: D[K] | undefined): void;
  addIndexesFor<K extends keyof D>(key: K, val: D[K] | undefined, entity: Entity<D, any>): void;
}

export abstract class Entity<
  D extends Record<string, any>,
  C extends Record<string, any>>
{

  public id?: string;

  /** The most recently saved props, or all unsaved props */
  private _data: D;
  /** Contains only new changes, and only when an entity is saved */
  private newData: Partial<D> = {};

  /** The associations this was created with, whether an existing or new entity */
  private assocs = new Set<Entity<any, any>>();
  /** A copy of assocs, which all updates act on, whether an existing or new entity */
  private newAssocs = new Set<Entity<any, any>>();

  public readonly data: D;

  /** Don't call directly; use manager.create() */
  public constructor(
    id: string | null,
    public kind: EntityKind,
    data: D,
    public computed: C,
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

  public guaranteedId() {
    if (!this.id) throw new Error('Trying to access null deal id!');
    return this.id;
  }

  // Properties

  private get<K extends keyof D>(key: K) {
    if (this.id === undefined) return this._data[key];
    if (key in this.newData) return this.newData[key];
    return this._data[key];
  }

  private set<K extends keyof D>(key: K, val: D[K]) {
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

  public hasPropertyChanges() {
    return this.id === undefined || Object.keys(this.newData).length > 0;
  }

  public getPropertyChanges() {
    if (this.id === undefined) return this._data;
    return this.newData;
  }

  public applyPropertyChanges() {
    Object.assign(this._data, this.newData);
    this.newData = {};
  }

  // Associations

  protected makeDynamicAssociation<T extends Entity<any, any>>(kind: EntityKind) {
    return {
      getAll: () => this.getAssociations(kind) as T[],
      has: (entity: T) => this.hasAssociation(entity),
      add: (entity: T) => this.addAssociation(entity, { firstSide: true, initial: false }),
      remove: (entity: T) => this.removeAssociation(entity, { firstSide: true }),
      clear: () => this.clearAssociations(kind),
    };
  }

  /** Don't use directly; use deal.contacts.add(c) etc. */
  public addAssociation(entity: Entity<any, any>, meta: { firstSide: boolean, initial: boolean }) {
    if (meta.initial) this.assocs.add(entity);
    this.newAssocs.add(entity);

    if (meta.firstSide) entity.addAssociation(this, { firstSide: false, initial: meta.initial });
  }

  private removeAssociation(entity: Entity<any, any>, meta: { firstSide: boolean }) {
    this.newAssocs.delete(entity);

    if (meta.firstSide) entity.removeAssociation(this, { firstSide: false });
  }

  private hasAssociation(entity: Entity<any, any>) {
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

  public hasAssociationChanges() {
    return (
      [...this.assocs].some(e => !this.newAssocs.has(e)) ||
      [...this.newAssocs].some(e => !this.assocs.has(e))
    );
  }

  public getAssociationChanges() {
    const toAdd = [...this.newAssocs].filter(e => !this.assocs.has(e));
    const toDel = [...this.assocs].filter(e => !this.newAssocs.has(e));
    return [
      ...toAdd.map(e => ({ op: 'add', other: e })),
      ...toDel.map(e => ({ op: 'del', other: e })),
    ] as { op: 'add' | 'del', other: Entity<any, any> }[];
  }

  public applyAssociationChanges() {
    this.assocs = new Set(this.newAssocs);
  }

}
