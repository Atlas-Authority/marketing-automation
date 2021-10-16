export type HubspotEntityKind = 'deal' | 'contact' | 'company';

export abstract class HubspotEntity<P extends { [key: string]: any }> {

  id?: string;

  private props: P;
  private newProps: Partial<P>;

  private assocs: [HubspotEntityKind, HubspotEntity<any>][] = [];
  private newAssocs: [HubspotEntityKind, HubspotEntity<any>][] = [];

  constructor(id: string | null, props: P) {
    if (id) this.id = id;
    this.props = props;
    this.newProps = {};
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

  protected makeDynamicAssociation<T extends HubspotEntity<any>>(kind: HubspotEntityKind) {
    return {
      add: (entity: T) => this.addAssociation(kind, entity),
      remove: (entity: T) => this.removeAssociation(kind, entity),
    };
  }

  public _addRawAssociation(kind: HubspotEntityKind, entity: HubspotEntity<any>) {
    this.assocs.push([kind, entity]);
  }

  private addAssociation(kind: HubspotEntityKind, entity: HubspotEntity<any>) {

  }

  private removeAssociation(kind: HubspotEntityKind, entity: HubspotEntity<any>) {

  }

  private hasAssociationChanges() {

  }

  private getAssociationChanges() {

  }

  private applyAssociationChanges() {

  }

}
