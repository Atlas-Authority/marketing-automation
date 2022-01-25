import * as assert from 'assert';
import { Logger } from '../log/logger';
import { AttachableError } from "../util/errors";
import HubspotAPI from "./api";
import { Entity } from './entity';
import { EntityAdapter, EntityKind } from './interfaces';
import { typedEntries } from "./manager";

export class HubspotUploader<D extends Record<string, any>> {

  api;
  constructor(
    log: Logger | null,
    private entities: Entity<D>[],
    private adapter: EntityAdapter<D>,
  ) {
    this.api = new HubspotAPI(log);
  }

  public async syncUpAllEntitiesProperties() {
    const entitiesWithChanges = this.entities.map(e => ({ e, changes: e.getPropertyChanges() }));
    const toSync = entitiesWithChanges.filter(({ changes }) => Object.keys(changes).length > 0);

    const toCreate = toSync.filter(({ e }) => e.id === undefined);
    const toUpdate = toSync.filter(({ e }) => e.id !== undefined);

    if (toCreate.length > 0) {
      const results = await this.api.createEntities(
        this.adapter.kind,
        toCreate.map(({ changes }) => ({
          properties: changes as Record<string, string>,
        }))
      );

      const identifiers = typedEntries(this.adapter.data).filter(([k, v]) => v.identifier);

      for (const { e } of toCreate) {
        const found = results.find(result => {
          for (const [localIdKey, spec] of identifiers) {
            const localVal = e.data[localIdKey];
            const hsLocal = spec.up(localVal);
            const hsRemote = result.properties[spec.property!] ?? '';
            if (hsLocal !== hsRemote) return false;
          }
          return true;
        });

        if (!found) {
          throw new AttachableError("Couldn't find ", JSON.stringify({
            local: e.data,
            remotes: results.map(r => ({
              id: r.id,
              properties: r.properties,
            })),
          }, null, 2));
        }

        assert.ok(found);
        e.id = found.id;
      }
    }

    if (toUpdate.length > 0) {
      const results = await this.api.updateEntities(
        this.adapter.kind,
        toUpdate.map(({ e, changes }) => ({
          id: e.guaranteedId(),
          properties: changes as Record<string, string>,
        }))
      );
    }
  }

  public async syncUpAllAssociations() {
    const toSync = (this.entities
      .filter(e => e.hasAssociationChanges())
      .flatMap(e => e.getAssociationChanges()
        .map(({ op, other }) => ({ op, from: e, to: other }))));

    const upAssociations = (Object.entries(this.adapter.associations)
      .filter(([kind, dir]) => dir.includes('up'))
      .map(([kind, dir]) => kind as EntityKind));

    for (const otherKind of upAssociations) {
      const toSyncInKind = (toSync
        .filter(changes => changes.to.kind === otherKind)
        .map(changes => ({
          ...changes,
          inputs: {
            fromId: changes.from.guaranteedId(),
            toId: changes.to.guaranteedId(),
            toType: otherKind,
          }
        })));

      const toAdd = toSyncInKind.filter(changes => changes.op === 'add');
      const toDel = toSyncInKind.filter(changes => changes.op === 'del');

      await this.api.createAssociations(
        this.adapter.kind,
        otherKind,
        toAdd.map(changes => changes.inputs),
      );

      await this.api.deleteAssociations(
        this.adapter.kind,
        otherKind,
        toDel.map(changes => changes.inputs),
      );
    }
  }

}
