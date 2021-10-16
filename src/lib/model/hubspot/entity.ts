export abstract class HubspotEntity<T extends { [key: string]: any }> {

  id?: string;
  private props: T;
  private newProps: Partial<T>;

  constructor(id: string | null, props: T) {
    if (id) this.id = id;
    this.props = props;
    this.newProps = {};
  }

  set<K extends keyof T>(key: K, val: T[K]) {
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

  get<K extends keyof T>(key: K): T[K] | undefined {
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
