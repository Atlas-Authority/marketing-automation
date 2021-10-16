export type HubspotEntityKind = 'deal' | 'contact' | 'company';

export abstract class HubspotEntity<P extends { [key: string]: any }> {

  id?: string;
  private props: P;
  private newProps: Partial<P>;

  assocs: [HubspotEntityKind, HubspotEntity<any>][] = [];
  newAssocs: [HubspotEntityKind, HubspotEntity<any>][] = [];

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

}
