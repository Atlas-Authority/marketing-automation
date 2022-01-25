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
    data: D,
    public computed: C,
    private indexer: Indexer<D>,
  ) {
    this.id = id;
    if (id) Object.assign(this._oldData, data);
    Object.assign(this.newData, data);

    type K = keyof D;
    this.data = new Proxy(this.newData, {
      set: (_target, _key, _val) => {
        const key = _key as K;
        const val = _val as D[K];
        this.indexer.removeIndexesFor(key, this);
        this.newData[key] = val;
        this.indexer.addIndexesFor(key, val, this);
        return true;
      },
    });
  }

  get kind() {
    return this.adapter.kind;
  }

  public guaranteedId() {
    if (!this.id) throw new Error('Trying to access null deal id!');
    return this.id;
  }

  // Properties

  public hasPropertyChanges() {
    return Object.keys(this.getPropertyChanges()).length > 0;
  }

  public getPropertyChanges() {
    const upProperties: Partial<{ [K in keyof D]: string }> = Object.create(null);
    for (const [k, v] of Object.entries(this.newData)) {
      if (v !== this._oldData[k]) {
        const spec = this.adapter.data[k];
        if (spec.property) {
          const upKey = spec.property as keyof D;
          const upVal = spec.up(v);
          upProperties[upKey] = upVal;
        }
      }
    }
    return upProperties;
  }

  // Associations

  protected makeDynamicAssociation<T extends Entity<any, any>>(kind: EntityKind) {
    return {
      getAll: () => this.getAssociations(kind) as T[],
      add: (entity: T) => this.addAssociation(entity, { firstSide: true, initial: false }),
      clear: () => this.clearAssociations(kind),
    };
  }

  /** Don't use directly; use deal.contacts.add(c) etc. */
  public addAssociation(entity: Entity<any, any>, meta: { firstSide: boolean, initial: boolean }) {
    if (meta.initial) this.oldAssocs.add(entity);
    this.newAssocs.add(entity);

    if (meta.firstSide) entity.addAssociation(this, { firstSide: false, initial: meta.initial });
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
