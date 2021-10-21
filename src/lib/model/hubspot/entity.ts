import * as assert from 'assert';
import { EntityKind, RelativeAssociation } from '../../io/hubspot.js';

export interface EntityDatabase {
  getEntity(kind: EntityKind, id: string): Entity<any>;
}

export abstract class Entity<P extends { [key: string]: any }> {

  id?: string;

  /** The most recently saved props, or all unsaved props */
  private props: P;
  /** Contains only new changes, and only when an entity is saved */
  private newProps: Partial<P> = {};

  /** The associations this was created with, whether an existing or new entity */
  private assocs = new Set<RelativeAssociation>();
  /** A copy of assocs, which all updates act on, whether an existing or new entity */
  private newAssocs = new Set<RelativeAssociation>();

  data: { [K in keyof P]: P[K] };

  constructor(
    private db: EntityDatabase,
    id: string | null,
    props: P,
    associations: Set<RelativeAssociation>
  ) {
    if (id) this.id = id;
    this.props = props;
    this.assocs = associations;
    this.newAssocs = new Set(associations);

    type K = keyof P;
    this.data = new Proxy(props, {
      get: (_target, _key) => {
        return this.get(_key as K);
      },
      set: (_target, _key, _val) => {
        this.set(_key as K, _val as P[K]);
        return true;
      },
    });
  }

  guaranteedId() {
    assert.ok(this.id);
    return this.id;
  }

  // Properties

  get<K extends keyof P>(key: K) {
    if (this.id === undefined) return this.props[key];
    if (key in this.newProps) return this.newProps[key];
    return this.props[key];
  }

  set<K extends keyof P>(key: K, val: P[K]) {
    if (this.id === undefined) {
      this.props[key] = val;
      return;
    }

    const oldVal = this.props[key];
    if (oldVal === val) {
      delete this.newProps[key];
    }
    else {
      this.newProps[key] = val;
    }
  }

  hasPropertyChanges() {
    return this.id === undefined || Object.keys(this.newProps).length > 0;
  }

  getPropertyChanges() {
    if (this.id === undefined) return this.props;
    return this.newProps;
  }

  applyPropertyChanges() {
    Object.assign(this.props, this.newProps);
    this.newProps = {};
  }

  // Associations

  protected makeDynamicAssociation<T extends Entity<any>>(kind: EntityKind) {
    return {
      getAll: () => this.getAssociations(kind) as T[],
      has: (entity: T) => this.hasAssociation(kind, entity),
      add: (entity: T) => this.addAssociation(kind, entity),
      remove: (entity: T) => this.removeAssociation(kind, entity),
      clear: () => this.clearAssociations(kind),
    };
  }

  private addAssociation(kind: EntityKind, entity: Entity<any>) {
    this.newAssocs.add(`${kind}:${entity.guaranteedId()}`);
  }

  private removeAssociation(kind: EntityKind, entity: Entity<any>) {
    this.newAssocs.delete(`${kind}:${entity.guaranteedId()}`);
  }

  private hasAssociation(kind: EntityKind, entity: Entity<any>) {
    return this.newAssocs.has(`${kind}:${entity.guaranteedId()}`);
  }

  private getAssociations(kind: EntityKind) {
    return ([...this.newAssocs]
      .map(a => this.getAssocInfo(a))
      .filter(a => a.kind === kind)
      .map((a => this.db.getEntity(kind, a.id)))
    );
  }

  private clearAssociations(kind: EntityKind) {
    for (const a of this.newAssocs) {
      if (this.getAssocInfo(a).kind === kind) {
        this.newAssocs.delete(a);
      }
    }
  }

  hasAssociationChanges() {
    return (
      [...this.assocs].sort().join() !==
      [...this.newAssocs].sort().join()
    );
  }

  getAssociationChanges() {
    const toAdd = [...this.newAssocs].filter(a => !this.assocs.has(a));
    const toDel = [...this.assocs].filter(a => !this.newAssocs.has(a));
    return [
      ...toAdd.map(a => ({ op: 'add', ...this.getAssocInfo(a) })),
      ...toDel.map(a => ({ op: 'del', ...this.getAssocInfo(a) })),
    ] as { op: 'add' | 'del', kind: EntityKind, id: string }[];
  }

  private getAssocInfo(a: RelativeAssociation) {
    const [kind, id] = a.split(':');
    return { kind: kind as EntityKind, id };
  }

  applyAssociationChanges() {
    this.assocs = new Set(this.newAssocs);
  }

}
