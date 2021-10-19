import * as assert from 'assert';
import { FullEntity, NewEntity, ExistingEntity, Association, EntityKind } from '../../io/hubspot.js';
import { batchesOf } from '../../util/helpers.js';
import { EntityDatabase, HubspotAssociationString, HubspotEntity } from "./entity.js";

interface Downloader {
  downloadAllEntities(kind: EntityKind, apiProperties: string[], inputAssociations: string[]): Promise<FullEntity[]>;
}

interface Uploader {
  createEntities(kind: EntityKind, inputs: NewEntity[]): Promise<ExistingEntity[]>;
  updateEntities(kind: EntityKind, inputs: ExistingEntity[]): Promise<ExistingEntity[]>;

  createAssociations(fromKind: EntityKind, toKind: EntityKind, inputs: Association[]): Promise<void>;
  deleteAssociations(fromKind: EntityKind, toKind: EntityKind, inputs: Association[]): Promise<void>;
}

export type HubspotPropertyTransformers<T> = {
  [P in keyof T]: (prop: T[P]) => [string, string]
};

export abstract class HubspotEntityManager<
  P extends { [key: string]: any },
  E extends HubspotEntity<P>>
{

  constructor(
    private downloader: Downloader,
    private uploader: Uploader,
    private db: EntityDatabase
  ) { }

  protected abstract Entity: new (db: EntityDatabase, id: string | null, props: P, associations: Set<HubspotAssociationString>) => E;
  protected abstract kind: EntityKind;
  protected abstract associations: EntityKind[];

  protected abstract apiProperties: string[];
  protected abstract fromAPI(data: { [key: string]: string }): P | null;
  protected abstract toAPI: HubspotPropertyTransformers<P>;

  protected abstract identifiers: (keyof P)[];

  protected entities = new Map<string, E>();

  public async downloadAllEntities() {
    const data = await this.downloader.downloadAllEntities(this.kind, this.apiProperties, this.associations);

    for (const raw of data) {
      const props = this.fromAPI(raw.properties);
      if (!props) continue;

      const associations = new Set<HubspotAssociationString>();
      for (const item of raw.associations) {
        const prefix = `${this.kind}_to_`;
        assert.ok(item.type.startsWith(prefix));
        const otherKind = item.type.substr(prefix.length) as EntityKind;
        associations.add(`${otherKind}_${item.id}`);
      }

      const entity = new this.Entity(this.db, raw.id, props, associations);
      this.entities.set(entity.guaranteedId(), entity);
    }
  }

  public get(id: string) {
    return this.entities.get(id);
  }

  public getAll() {
    return this.entities.values();
  }

  public async syncUpAllEntities() {
    this.syncUpAllEntitiesProperties();
    this.syncUpAllEntitiesAssociations();
  }

  private async syncUpAllEntitiesProperties() {
    const toSync = [...this.entities.values()].filter(e => e.hasPropertyChanges());
    const toCreate = toSync.filter(e => e.id === undefined);
    const toUpdate = toSync.filter(e => e.id !== undefined);

    if (toCreate.length > 0) {
      const amount = this.kind === 'contact' ? 10 : 100;
      const groupsToCreate = batchesOf(toCreate, amount);
      for (const entitiesToCreate of groupsToCreate) {
        const results = await this.uploader.createEntities(
          this.kind,
          entitiesToCreate.map(e => ({
            properties: this.getChangedProperties(e),
          }))
        );

        for (const e of entitiesToCreate) {
          e.applyUpdates();
        }

        for (const e of entitiesToCreate) {
          const found = results.find(result => {
            for (const localIdKey of this.identifiers) {
              const localVal = e.get(localIdKey);
              assert.ok(localVal);
              const [remoteIdKey, hsLocal] = this.toAPI[localIdKey](localVal);
              const hsRemote = result.properties[remoteIdKey];
              if (hsLocal !== hsRemote) return false;
            }
            return true;
          });

          assert.ok(found);
          e.id = found.id;
          this.entities.set(found.id, e);
        }
      }
    }

    if (toUpdate.length > 0) {
      const groupsToUpdate = batchesOf(toUpdate, 100);
      for (const entitiesToUpdate of groupsToUpdate) {
        const results = await this.uploader.updateEntities(
          this.kind,
          entitiesToUpdate.map(e => ({
            id: e.guaranteedId(),
            properties: this.getChangedProperties(e),
          }))
        );

        for (const e of entitiesToUpdate) {
          e.applyUpdates();
        }
      }
    }
  }

  private async syncUpAllEntitiesAssociations() {
    const toSync = ([...this.entities.values()]
      .filter(e => e.hasAssociationChanges())
      .flatMap(e => e.getAssociationChanges()
        .map(changes => ({ e, ...changes }))));

    for (const otherKind of this.associations) {
      const toSyncInKind = (toSync
        .filter(changes => changes.kind === otherKind)
        .map(changes => ({
          ...changes,
          inputs: {
            fromId: changes.e.guaranteedId(),
            toId: changes.id,
            toType: otherKind,
          }
        })));

      const toAdd = toSyncInKind.filter(changes => changes.op === 'add');
      const toDel = toSyncInKind.filter(changes => changes.op === 'del');

      for (const toAddSubset of batchesOf(toAdd, 100)) {
        await this.uploader.createAssociations(
          this.kind,
          otherKind,
          toAddSubset.map(changes => changes.inputs),
        );
      }

      for (const toDelSubset of batchesOf(toDel, 100)) {
        await this.uploader.deleteAssociations(
          this.kind,
          otherKind,
          toDelSubset.map(changes => changes.inputs),
        );
      }
    }

    for (const changes of toSync) {
      changes.e.applyAssociationChanges();
    }
  }

  private getChangedProperties(e: E) {
    const properties: { [key: string]: string } = {};
    for (const [k, v] of Object.entries(e.getPropertyChanges())) {
      const fn = this.toAPI[k];
      const [newKey, newVal] = fn(v);
      properties[newKey] = newVal;
    }
    return properties;
  }

}
