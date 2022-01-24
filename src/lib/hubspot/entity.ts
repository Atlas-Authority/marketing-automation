import { EntityAdapter, EntityKind } from "./interfaces";

export interface Indexer<D> {
  removeIndexesFor<K extends keyof D>(key: K, entity: Entity<D, any>): void;
  addIndexesFor<K extends keyof D>(key: K, val: D[K] | undefined, entity: Entity<D, any>): void;
}

export abstract class Entity<
  D extends Record<string, any>,
  C extends Record<string, any>>
{

  public id: string | null;

  private _oldData: D = Object.create(null);
  private newData: D = Object.create(null);

  private oldAssocs = new Set<Entity<any, any>>();
  private newAssocs = new Set<Entity<any, any>>();

  public readonly data: D;

  /** Don't call directly; use manager.create() */
  public constructor(
    id: string | null,
    public adapter: EntityAdapter<D, C>,
    oldData: Partial<D>,
    newData: D,
    public computed: C,
    private indexer: Indexer<D>,
  ) {
    this.id = id;
    Object.assign(this._oldData, oldData);
    Object.assign(this.newData, newData);

    type K = keyof D;
    this.data = new Proxy(this.newData, {
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

  private set<K extends keyof D>(key: K, val: D[K]) {
    this.indexer.removeIndexesFor(key, this);
    this.newData[key] = val;
    this.indexer.addIndexesFor(key, val, this);
  }

  public hasPropertyChanges() {
    return Object.keys(this.getPropertyChanges()).length > 0;
  }

  public getPropertyChanges() {
    const upProperties: Partial<{ [K in keyof D]: string }> = Object.create(null);
    for (const [k, v] of Object.entries(this.newData)) {
      if (this.newData[k] === this._oldData[k]) continue;

      const spec = this.adapter.data[k];
      if (spec.property) {
        const upKey = spec.property as keyof D;
        const upVal = spec.up(v);
        upProperties[upKey] = upVal;
      }
    }
    return upProperties;

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
    if (meta.initial) this.oldAssocs.add(entity);
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
    return [...this.newAssocs].filter(e => e.adapter.kind === kind);
  }

  private clearAssociations(kind: EntityKind) {
    for (const e of this.newAssocs) {
      if (e.adapter.kind === kind) {
        this.newAssocs.delete(e);
      }
    }
  }

  public hasAssociationChanges() {
    return (
      [...this.oldAssocs].some(e => !this.newAssocs.has(e)) ||
      [...this.newAssocs].some(e => !this.oldAssocs.has(e))
    );
  }

  public getAssociationChanges() {
    const toAdd = [...this.newAssocs].filter(e => !this.oldAssocs.has(e));
    const toDel = [...this.oldAssocs].filter(e => !this.newAssocs.has(e));
    return [
      ...toAdd.map(e => ({ op: 'add', other: e })),
      ...toDel.map(e => ({ op: 'del', other: e })),
    ] as { op: 'add' | 'del', other: Entity<any, any> }[];
  }

}
