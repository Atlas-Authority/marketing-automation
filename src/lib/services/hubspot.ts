import * as hubspot from '@hubspot/api-client';
import assert from 'assert';
import config from '../config/index.js';
import { Association, EntityKind, ExistingEntity, FullEntity, NewEntity, RelativeAssociation } from '../io/hubspot.js';
import { SimpleError } from '../util/errors.js';

export default class Hubspot {

  client = new hubspot.Client({ apiKey: config.hubspot.apiKey });

  async downloadEntities(kind: EntityKind, apiProperties: string[], inputAssociations: string[]): Promise<FullEntity[]> {
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
      return normalizedEntities;
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
  }

  async createEntities(kind: EntityKind, inputs: NewEntity[]): Promise<ExistingEntity[]> {
    return (await this.apiFor(kind).batchApi.create({ inputs })).body.results;
  }

  async updateEntities(kind: EntityKind, inputs: ExistingEntity[]): Promise<ExistingEntity[]> {
    return (await this.apiFor(kind).batchApi.update({ inputs })).body.results;
  }

  async createAssociations(fromKind: EntityKind, toKind: EntityKind, inputs: Association[]): Promise<void> {
    await this.client.crm.associations.batchApi.create(fromKind, toKind, {
      inputs: inputs.map(input => ({
        from: { id: input.fromId },
        to: { id: input.toId },
        type: input.toType,
      }))
    });
  }

  async deleteAssociations(fromKind: EntityKind, toKind: EntityKind, inputs: Association[]): Promise<void> {
    await this.client.crm.associations.batchApi.archive(fromKind, toKind, {
      inputs: inputs.map(input => ({
        from: { id: input.fromId },
        to: { id: input.toId },
        type: input.toType,
      }))
    });
  }

  private apiFor(kind: EntityKind) {
    switch (kind) {
      case 'deal': return this.client.crm.deals;
      case 'company': return this.client.crm.companies;
      case 'contact': return this.client.crm.contacts;
    }
  }

}
