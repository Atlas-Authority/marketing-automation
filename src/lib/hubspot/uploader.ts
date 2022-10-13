import * as assert from 'assert';
import { ConsoleLogger } from '../log/console';
import { AttachableError } from "../util/errors";
import HubspotAPI from "./api";
import { Entity } from './entity';
import { Hubspot } from './hubspot';
import { EntityKind } from './interfaces';
import { EntityManager, typedEntries } from "./manager";

export class HubspotUploader {

  api;
  constructor(console?: ConsoleLogger) {
    this.api = new HubspotAPI(console);
  }

  public async upsyncChangesToHubspot(hubspot: Hubspot) {
    await this.syncUpAllEntitiesProperties(hubspot.dealManager);
    await this.syncUpAllEntitiesProperties(hubspot.contactManager);
    await this.syncUpAllEntitiesProperties(hubspot.companyManager);

    await this.syncUpAllAssociations(hubspot.dealManager);
    await this.syncUpAllAssociations(hubspot.contactManager);
    await this.syncUpAllAssociations(hubspot.companyManager);
  }

  private async syncUpAllEntitiesProperties<D extends Record<string, any>, E extends Entity<D>>(manager: EntityManager<D, E>) {
    const entitiesWithChanges = manager.getArray().map(e => ({ e, changes: e.getPropertyChanges() }));
    const toSync = entitiesWithChanges.filter(({ changes }) => Object.keys(changes).length > 0);

    const toCreate = toSync.filter(({ e }) => e.id === null);
    const toUpdate = toSync.filter(({ e }) => e.id !== null);

    if (toCreate.length > 0) {
      const results = await this.api.createEntities(
        manager.entityAdapter.kind,
        toCreate.map(({ changes }) => ({
          properties: changes as Record<string, string>,
        }))
      );

      const identifiers = typedEntries(manager.entityAdapter.data).filter(([k, v]) => v.identifier);

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
        manager.entityAdapter.kind,
        toUpdate.map(({ e, changes }) => ({
          id: e.guaranteedId(),
          properties: changes as Record<string, string>,
        }))
      );
    }
  }

  private async syncUpAllAssociations<D extends Record<string, any>, E extends Entity<D>>(manager: EntityManager<D, E>) {
    const toSync = (manager.getArray()
      .filter(e => e.hasAssociationChanges())
      .flatMap(e => e.getAssociationChanges()
        .map(({ op, other }) => ({ op, from: e, to: other }))));

    const upAssociations = (Object.entries(manager.entityAdapter.associations)
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
        manager.entityAdapter.kind,
        otherKind,
        toAdd.map(changes => changes.inputs),
      );

      await this.api.deleteAssociations(
        manager.entityAdapter.kind,
        otherKind,
        toDel.map(changes => changes.inputs),
      );
    }
  }

}
