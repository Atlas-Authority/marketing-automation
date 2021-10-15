export abstract class HubspotEntity<T extends { [key: string]: any }> {

  id?: string;
  props: T;
  newProps: Partial<T>;

  constructor(id: string | null, props: T) {
    if (id) this.id = id;
    this.props = props;
    this.newProps = {};
  }

  set<K extends keyof T>(key: K, val: T[K]) {
    const oldVal = this.props[key];
    if (oldVal === val) {
      delete this.newProps[key];
    }
    else {
      this.newProps[key] = val;
    }
  }

  hasChanges() {
    return Object.keys(this.newProps).length > 0;
  }

  applyUpdates() {
    Object.assign(this.props, this.newProps);
  }

}
