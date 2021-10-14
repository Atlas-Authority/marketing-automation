import { HubspotInputObject } from "./manager.js";

type HubspotEntityCtorOptions<T> = { props: T } | HubspotInputObject;

export abstract class HubspotEntity<T extends { [key: string]: any }> {

  id?: string;
  props: T;
  newProps: Partial<T>;

  constructor(options: HubspotEntityCtorOptions<T>) {
    if ('id' in options) {
      this.id = options.id;
      this.props = this.fromAPI(options.props as HubspotInputObject['properties']);
    }
    else {
      this.props = options.props;
    }
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
