export class MultiRecordMap<T extends { ids: Set<string> }, U> {

  #idsToKeys = new Map<string, T[]>();
  #realMap = new Map<T, U>();

  public set(key: T, val: U) {
    let realKeys = this.#realKeysForKey(key);
    if (!realKeys) {
      realKeys = [key];
    }
    else if (!realKeys.includes(key)) {
      realKeys.push(key);
    }

    for (const id of key.ids) {
      this.#idsToKeys.set(id, realKeys);
    }

    const finalKey = realKeys[0];
    this.#realMap.set(finalKey, val);
  }

  public get(key: T): U | undefined {
    const realKey = this.#realKeysForKey(key)?.[0];
    if (!realKey) return undefined;
    return this.#realMap.get(realKey);
  }

  public entries() {
    return this.#realMap.entries();
  }

  #realKeysForKey(key: T) {
    return [...key.ids].map(id => this.#idsToKeys.get(id)).find(o => o);
  }

}
