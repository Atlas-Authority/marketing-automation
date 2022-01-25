import * as hubspot from '@hubspot/api-client';
import assert from 'assert';
import { ConsoleLogger } from '../log/logger';
import { hubspotCredsFromENV } from '../parameters/env-config';
import { KnownError } from '../util/errors';
import { batchesOf, isPresent } from '../util/helpers';
import { Association, EntityAdapter, EntityKind, ExistingEntity, NewEntity, RelativeAssociation } from './interfaces';
import { typedEntries } from './manager';

export type HubspotCreds = {
  accessToken: string,
} | {
  apiKey: string,
};

export default class HubspotAPI {

  private client: hubspot.Client;

  constructor(private log: ConsoleLogger | null) {
    this.client = new hubspot.Client(hubspotCredsFromENV());
  }

  public async downloadHubspotEntities<D>(entityAdapter: EntityAdapter<D>) {
    const inputAssociations = (Object.entries(entityAdapter.associations)
      .filter(([kind, dir]) => dir.includes('down'))
      .map(([kind, dir]) => kind));

    const apiProperties = [
      ...typedEntries(entityAdapter.data).map(([k, v]) => v.property).filter(isPresent),
      ...entityAdapter.additionalProperties,
    ];

    let associations = ((inputAssociations.length > 0)
      ? inputAssociations
      : undefined);

    try {
      const entities = await this.apiFor(entityAdapter.kind).getAll(undefined, undefined, apiProperties, associations);
      const normalizedEntities = entities.map(({ id, properties, associations }) => ({
        id,
        properties,
        associations: Object.entries(associations || {})
          .flatMap(([, { results }]) => (
            results.map(item => {
              const prefix = `${entityAdapter.kind}_to_`;
              assert.ok(item.type.startsWith(prefix));
              const otherKind = item.type.substr(prefix.length) as EntityKind;
              return `${otherKind}:${item.id}` as RelativeAssociation;
            })
          )),
      }));
      return normalizedEntities;
    }
    catch (e: any) {
      const body = e.response?.body;
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
        throw new KnownError(`Hubspot v3 API for "${entityAdapter.kind}" had internal error.`);
      }
      else {
        throw new Error(`Failed downloading ${entityAdapter.kind}s: ${JSON.stringify(body)}`);
      }
    }
  }

  public async createEntities(kind: EntityKind, entities: NewEntity[]): Promise<ExistingEntity[]> {
    return await this.batchDo(kind, entities, async entities => {
      const response = await this.apiFor(kind).batchApi.create({ inputs: entities });
      return response.body.results;
    });
  }

  public async updateEntities(kind: EntityKind, entities: ExistingEntity[]): Promise<ExistingEntity[]> {
    return await this.batchDo(kind, entities, async entities => {
      const response = await this.apiFor(kind).batchApi.update({ inputs: entities });
      return response.body.results;
    });
  }

  private async batchDo<T, U>(kind: EntityKind, entities: T[], fn: (array: T[]) => Promise<U[]>) {
    const batchSize = kind === 'contact' ? 10 : 100;
    const entityGroups = batchesOf(entities, batchSize);

    const promises = entityGroups.map(async (entities) => {
      try {
        return await fn(entities);
      }
      catch (e: any) {
        throw new Error(e.response.body.message);
      }
    });

    const resultGroups = await Promise.all(promises);
    return resultGroups.flat(1);
  }

  public async createAssociations(fromKind: EntityKind, toKind: EntityKind, inputs: Association[]): Promise<void> {
    for (const inputBatch of batchesOf(inputs, 100)) {
      const response = await this.client.crm.associations.batchApi.create(fromKind, toKind, {
        inputs: inputBatch.map(input => mapAssociationInput(fromKind, input))
      });
      for (const e of response.body.errors ?? []) {
        this.log?.error('Live Hubspot', e.message);
      }
    }
  }

  public async deleteAssociations(fromKind: EntityKind, toKind: EntityKind, inputs: Association[]): Promise<void> {
    for (const inputBatch of batchesOf(inputs, 100)) {
      await this.client.crm.associations.batchApi.archive(fromKind, toKind, {
        inputs: inputBatch.map(input => mapAssociationInput(fromKind, input))
      });
    }
  }

  private apiFor(kind: EntityKind) {
    switch (kind) {
      case 'deal': return this.client.crm.deals;
      case 'company': return this.client.crm.companies;
      case 'contact': return this.client.crm.contacts;
    }
  }

}

function mapAssociationInput(fromKind: EntityKind, input: Association) {
  return {
    from: { id: input.fromId },
    to: { id: input.toId },
    type: `${fromKind}_to_${input.toType}`,
  };
}
