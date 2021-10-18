import * as hubspot from '@hubspot/api-client';
import * as assert from 'assert';
import { SimpleError } from '../../util/errors.js';
import { batchesOf } from '../../util/helpers.js';
import { EntityDatabase, HubspotAssociationString, HubspotEntity, HubspotEntityKind } from "./entity.js";

type HubspotApiCreateEntitiesInput = {
  properties: { [key: string]: string },
};

type HubspotApiUpdateEntitiesInput = (
  HubspotApiCreateEntitiesInput & { id: string }
);

type HubspotApiCreateEntitiesOutput = {
  id: string,
  properties: { [key: string]: string },
}[];

type HubspotApiUpdateEntitiesOutput = HubspotApiCreateEntitiesOutput;

type HubspotApiDownloadedEntity = {
  id: string;
  properties: {
    [key: string]: string;
  };
  associations?: {
    [key: string]: {
      results: {
        type: string;
        id: string;
      }[];
    };
  };
};

type HubspotApiAssociationInput = {
  inputs: {
    from: {
      id: string;
    };
    to: {
      id: string;
    };
    type: string;
  }[];
};

interface Downloader {
  downloadAllEntities: (kind: HubspotEntityKind, apiProperties: string[], inputAssociations: string[]) => Promise<HubspotApiDownloadedEntity[]>;
}

interface Uploader {
  createEntities: (kind: HubspotEntityKind, inputs: HubspotApiCreateEntitiesInput[]) => Promise<HubspotApiCreateEntitiesOutput>;
  updateEntities: (kind: HubspotEntityKind, inputs: HubspotApiUpdateEntitiesInput[]) => Promise<HubspotApiUpdateEntitiesOutput>;

  createAssociations: (fromKind: HubspotEntityKind, toKind: HubspotEntityKind, input: HubspotApiAssociationInput) => Promise<void>;
  deleteAssociations: (fromKind: HubspotEntityKind, toKind: HubspotEntityKind, input: HubspotApiAssociationInput) => Promise<void>;
}

export type HubspotInputObject = {
  id: string,
  properties: { [key: string]: string },
  createdAt: Date,
  updatedAt: Date,
  archived?: boolean,
  archivedAt?: Date,
  associations?: {
    [key: string]: {
      results: {
        id: string,
        type: string,
      }[],
    },
  },
};

export type HubspotPropertyTransformers<T> = {
  [P in keyof T]: (prop: T[P]) => [string, string]
};

export abstract class HubspotEntityManager<
  P extends { [key: string]: any },
  E extends HubspotEntity<P>,
  I extends HubspotInputObject>
{

  constructor(private client: hubspot.Client, private db: EntityDatabase) { }

  protected abstract Entity: new (db: EntityDatabase, id: string | null, props: P, associations: Set<HubspotAssociationString>) => E;
  protected abstract kind: HubspotEntityKind;
  protected abstract associations: HubspotEntityKind[];

  protected abstract apiProperties: string[];
  protected abstract fromAPI(data: I['properties']): P | null;
  protected abstract toAPI: HubspotPropertyTransformers<P>;

  protected abstract identifiers: (keyof P)[];

  protected entities = new Map<string, E>();

  private api(kind: HubspotEntityKind) {
    switch (kind) {
      case 'deal': return this.client.crm.deals;
      case 'company': return this.client.crm.companies;
      case 'contact': return this.client.crm.contacts;
    }
  }

  public async downloadAllEntities() {
    const data = await this.downloader.downloadAllEntities(this.kind, this.apiProperties, this.associations);

    for (const raw of data) {
      const props = this.fromAPI(raw.properties);
      if (!props) continue;

      const associations = new Set<HubspotAssociationString>();
      for (const [, { results: list }] of Object.entries(raw.associations || {})) {
        for (const item of list) {
          const prefix = `${this.kind}_to_`;
          assert.ok(item.type.startsWith(prefix));
          const otherKind = item.type.substr(prefix.length) as HubspotEntityKind;
          associations.add(`${otherKind}_${item.id}`);
        }
      }

      const entity = new this.Entity(this.db, raw.id, props, associations);
      this.entities.set(entity.guaranteedId(), entity);
    }
  }

  public get(id: string) {
    return this.entities.get(id);
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
            from: { id: changes.e.guaranteedId() },
            to: { id: changes.id },
            type: `${this.kind}_${otherKind}`,
          }
        })));

      const toAdd = toSyncInKind.filter(changes => changes.op === 'add');
      const toDel = toSyncInKind.filter(changes => changes.op === 'del');

      for (const toAddSubset of batchesOf(toAdd, 100)) {
        await this.uploader.createAssociations(
          this.kind,
          otherKind,
          { inputs: toAddSubset.map(changes => changes.inputs) },
        );
      }

      for (const toDelSubset of batchesOf(toDel, 100)) {
        await this.uploader.deleteAssociations(
          this.kind,
          otherKind,
          { inputs: toDelSubset.map(changes => changes.inputs) },
        );
      }
    }

    for (const changes of toSync) {
      changes.e.applyAssociationChanges();
    }
  }

  private get downloader(): Downloader {
    return {
      downloadAllEntities: async (kind: HubspotEntityKind, apiProperties: string[], inputAssociations: string[]): Promise<HubspotApiDownloadedEntity[]> => {
        let associations = ((inputAssociations.length > 0)
          ? inputAssociations
          : undefined);

        try {
          return await this.api(kind).getAll(undefined, undefined, apiProperties, associations);
        }
        catch (e: any) {
          const body = e.response.body;
          if (
            (
              typeof body === 'string' && (
                body === 'internal error' ||
                body.startsWith('<!DOCTYPE html>'))
            ) || (
              typeof body === 'object' &&
              body.status === 'error' &&
              body.message === 'internal error'
            )
          ) {
            throw new SimpleError('Hubspot v3 API had internal error.');
          }
          else {
            throw new Error(`Failed downloading ${kind}s: ${JSON.stringify(body)}`);
          }

        }
      },
    };
  }

  private get uploader(): Uploader {
    return {
      createEntities: async (kind: HubspotEntityKind, inputs: HubspotApiCreateEntitiesInput[]): Promise<HubspotApiCreateEntitiesOutput> => {
        return (await this.api(kind).batchApi.create({ inputs })).body.results;
      },
      updateEntities: async (kind: HubspotEntityKind, inputs: HubspotApiUpdateEntitiesInput[]): Promise<HubspotApiUpdateEntitiesOutput> => {
        return (await this.api(kind).batchApi.update({ inputs })).body.results;
      },
      createAssociations: async (fromKind: HubspotEntityKind, toKind: HubspotEntityKind, input: HubspotApiAssociationInput): Promise<void> => {
        await this.client.crm.associations.batchApi.create(fromKind, toKind, input);
      },
      deleteAssociations: async (fromKind: HubspotEntityKind, toKind: HubspotEntityKind, input: HubspotApiAssociationInput): Promise<void> => {
        await this.client.crm.associations.batchApi.archive(fromKind, toKind, input);
      },
    };
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
