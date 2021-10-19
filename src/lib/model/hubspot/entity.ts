import * as assert from 'assert';
import { HubspotEntityKind } from '../../io/hubspot.js';

export type HubspotAssociationString = `${HubspotEntityKind}_${string}`;

export interface EntityDatabase {
  getEntity(kind: HubspotEntityKind, id: string): HubspotEntity<any>;
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
  }

  guaranteedId() {
    assert.ok(this.id);
    return this.id;
  }

  // Properties

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

  get<K extends keyof P>(key: K): P[K] | undefined {
    if (this.id === undefined) return this.props[key];
    if (key in this.newProps) return this.newProps[key];
    return this.props[key];
  }

  hasPropertyChanges() {
    return this.id === undefined || Object.keys(this.newProps).length > 0;
  }

  getPropertyChanges() {
    if (this.id === undefined) return this.props;
    return this.newProps;
  }

  applyUpdates() {
    Object.assign(this.props, this.newProps);
  }

  // Associations

  protected makeDynamicAssociation<T extends HubspotEntity<any>>(kind: HubspotEntityKind) {
    return {
      getAll: () => this.getAssociations(kind) as T[],
      add: (entity: T) => this.addAssociation(kind, entity),
      remove: (entity: T) => this.removeAssociation(kind, entity),
    };
  }

  private addAssociation(kind: HubspotEntityKind, entity: HubspotEntity<any>) {
    this.newAssocs.add(`${kind}_${entity.guaranteedId()}`);
  }

  private removeAssociation(kind: HubspotEntityKind, entity: HubspotEntity<any>) {
    this.newAssocs.delete(`${kind}_${entity.guaranteedId()}`);
  }

  private getAssociations(kind: HubspotEntityKind) {
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
    ] as { op: 'add' | 'del', kind: HubspotEntityKind, id: string }[];
  }

  private getAssocInfo(a: HubspotAssociationString) {
    const [kind, id] = a.split('_');
    return { kind: kind as HubspotEntityKind, id };
  }

  applyAssociationChanges() {
    this.assocs = new Set(this.newAssocs);
  }

}
