import * as assert from 'assert';
import { EntityKind, HubspotAssociationString } from '../../io/hubspot.js';

export interface EntityDatabase {
  getEntity(kind: EntityKind, id: string): HubspotEntity<any>;
}

export abstract class HubspotEntity<P extends { [key: string]: any }> {

  id?: string;

  /** The most recently saved props, or all unsaved props */
  private props: P;
  /** Contains only new changes, and only when an entity is saved */
  private newProps: Partial<P>;

  /** The associations this was created with, whether an existing or new entity */
  private assocs = new Set<HubspotAssociationString>();
  /** A copy of assocs, which all updates act on, whether an existing or new entity */
  private newAssocs = new Set<HubspotAssociationString>();

  data: { [K in keyof P]: P[K] };

  constructor(
    private db: EntityDatabase,
    id: string | null,
    props: P,
    associations?: Set<HubspotAssociationString>
  ) {
    if (id) this.id = id;
    this.props = props;
    this.newProps = {};
    if (associations) {
      this.assocs = associations;
      this.newAssocs = new Set(associations);
    }

    type K = keyof P;
    this.data = new Proxy(props, {
      get: (_target, _key) => {
        const key = _key as K;
        if (this.id === undefined) return this.props[key];
        if (key in this.newProps) return this.newProps[key];
        return this.props[key];
      },
      set: (_target, _key, _val) => {
        const key = _key as K;
        const val = _val as P[K];
        if (this.id === undefined) {
          this.props[key] = val;
          return true;
        }

        const oldVal = this.props[key];
        if (oldVal === val) {
          delete this.newProps[key];
        }
        else {
          this.newProps[key] = val;
        }
        return true;
      },
    });
  }

  guaranteedId() {
    assert.ok(this.id);
    return this.id;
  }

  // Properties

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

  protected makeDynamicAssociation<T extends HubspotEntity<any>>(kind: EntityKind) {
    return {
      getAll: () => this.getAssociations(kind) as T[],
      add: (entity: T) => this.addAssociation(kind, entity),
      remove: (entity: T) => this.removeAssociation(kind, entity),
    };
  }

  private addAssociation(kind: EntityKind, entity: HubspotEntity<any>) {
    this.newAssocs.add(`${kind}_${entity.guaranteedId()}`);
  }

  private removeAssociation(kind: EntityKind, entity: HubspotEntity<any>) {
    this.newAssocs.delete(`${kind}_${entity.guaranteedId()}`);
  }

  private getAssociations(kind: EntityKind) {
    return ([...this.newAssocs]
      .map(a => a.split('_'))
      .filter(([k,]) => k === kind)
      .map((([, id]) => this.db.getEntity(kind, id)))
    );
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

  private getAssocInfo(a: HubspotAssociationString) {
    const [kind, id] = a.split('_');
    return { kind: kind as EntityKind, id };
  }

  applyAssociationChanges() {
    this.assocs = new Set(this.newAssocs);
  }

}
