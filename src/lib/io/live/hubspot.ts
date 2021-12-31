import * as hubspot from '@hubspot/api-client';
import assert from 'assert';
import log from '../../log/logger';
import { Association, EntityKind, ExistingEntity, FullEntity, NewEntity, RelativeAssociation } from '../../model/hubspot/interfaces';
import { HubspotCreds } from '../../parameters/interfaces';
import { KnownError } from '../../util/errors';
import { batchesOf } from '../../util/helpers';
import cache from '../cache';
import { HubspotService, Progress } from '../interfaces';

export default class LiveHubspotService implements HubspotService {

  private client: hubspot.Client;

  constructor(creds: HubspotCreds) {
    this.client = new hubspot.Client(creds);
  }

  public async downloadEntities(_progess: Progress, kind: EntityKind, apiProperties: string[], inputAssociations: string[]): Promise<FullEntity[]> {
    let associations = ((inputAssociations.length > 0)
      ? inputAssociations
      : undefined);

    try {
      const entities = await this.apiFor(kind).getAll(undefined, undefined, apiProperties, associations);
      const normalizedEntities = entities.map(({ id, properties, associations }) => ({
        id,
        properties,
        associations: Object.entries(associations || {})
          .flatMap(([, { results }]) => (
            results.map(item => {
              const prefix = `${kind}_to_`;
              assert.ok(item.type.startsWith(prefix));
              const otherKind = item.type.substr(prefix.length) as EntityKind;
              return `${otherKind}:${item.id}` as RelativeAssociation;
            })
          )),
      }));
      return cache(`${kind}.json`, normalizedEntities);
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
        throw new KnownError(`Hubspot v3 API for "${kind}" had internal error.`);
      }
      else {
        throw new Error(`Failed downloading ${kind}s: ${JSON.stringify(body)}`);
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
        log.error('Live Hubspot', e.message);
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
