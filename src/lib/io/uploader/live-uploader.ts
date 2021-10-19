import * as hubspot from '@hubspot/api-client';
import assert from 'assert';
import { saveToJson } from '../../cache/inspection.js';
import config from '../../config/index.js';
import { contactToHubspotProperties } from '../../engine/contacts.js';
import log from '../../log/logger.js';
import { Company } from '../../types/company.js';
import { Contact, GeneratedContact } from '../../types/contact.js';
import { Deal, DealAssociationPair, DealCompanyAssociationPair, DealUpdate } from '../../types/deal.js';
import { batchesOf } from '../../util/helpers.js';
import { EntityKind, NewEntity, ExistingEntity, Association, apiFor } from '../hubspot.js';
import { Uploader } from './uploader.js';


export default class LiveUploader implements Uploader {

  hubspotClient = new hubspot.Client({ apiKey: config.hubspot.apiKey });

  async createEntities(kind: EntityKind, inputs: NewEntity[]): Promise<ExistingEntity[]> {
    return (await apiFor(this.hubspotClient, kind).batchApi.create({ inputs })).body.results;
  }

  async updateEntities(kind: EntityKind, inputs: ExistingEntity[]): Promise<ExistingEntity[]> {
    return (await apiFor(this.hubspotClient, kind).batchApi.update({ inputs })).body.results;
  }

  async createAssociations(fromKind: EntityKind, toKind: EntityKind, inputs: Association[]): Promise<void> {
    await this.hubspotClient.crm.associations.batchApi.create(fromKind, toKind, {
      inputs: inputs.map(input => ({
        from: { id: input.fromId },
        to: { id: input.toId },
        type: input.toType,
      }))
    });
  }

  async deleteAssociations(fromKind: EntityKind, toKind: EntityKind, inputs: Association[]): Promise<void> {
    await this.hubspotClient.crm.associations.batchApi.archive(fromKind, toKind, {
      inputs: inputs.map(input => ({
        from: { id: input.fromId },
        to: { id: input.toId },
        type: input.toType,
      }))
    });
  }

  async associateDealsWithContacts(fromTos: DealAssociationPair[]) {
    try {
      log.info('Live Uploader', 'Associating Deals->Contacts:', fromTos);
      await this.hubspotClient.crm.associations.batchApi.create('deal', 'contact', {
        inputs: fromTos.map(({ dealId, contactId }) => ({
          from: { id: dealId },
          to: { id: contactId },
          type: 'deal_to_contact',
        })),
      });
    }
    catch (e: any) {
      throw new Error(e.response.body.message);
    }
  }

  async disassociateDealsFromContacts(fromTos: DealAssociationPair[]) {
    try {
      log.info('Live Uploader', 'Disassociating Deals->Contacts:', fromTos);
      await this.hubspotClient.crm.associations.batchApi.archive('deal', 'contact', {
        inputs: fromTos.map(({ dealId, contactId }) => ({
          from: { id: dealId },
          to: { id: contactId },
          type: 'deal_to_contact',
        })),
      });
    }
    catch (e: any) {
      throw new Error(e.response.body.message);
    }
  }

  async associateDealsWithCompanies(fromTos: DealCompanyAssociationPair[]) {
    try {
      log.info('Live Uploader', 'Associating Deals->Companies:', fromTos);
      await this.hubspotClient.crm.associations.batchApi.create('deal', 'company', {
        inputs: fromTos.map(({ dealId, companyId }) => ({
          from: { id: dealId },
          to: { id: companyId },
          type: 'deal_to_company',
        })),
      });
    }
    catch (e: any) {
      throw new Error(e.response.body.message);
    }
  }

  async disassociateDealsFromCompanies(fromTos: DealCompanyAssociationPair[]) {
    try {
      log.info('Live Uploader', 'Disassociating Deals->Companies:', fromTos);
      await this.hubspotClient.crm.associations.batchApi.archive('deal', 'company', {
        inputs: fromTos.map(({ dealId, companyId }) => ({
          from: { id: dealId },
          to: { id: companyId },
          type: 'deal_to_company',
        })),
      });
    }
    catch (e: any) {
      throw new Error(e.response.body.message);
    }
  }

  async createAllContacts(contacts: Array<{ properties: GeneratedContact }>): Promise<Contact[]> {
    log.info('Live Uploader', 'Creating Contacts:', contacts);

    const contactGroups = batchesOf(contacts, 10);
    const promises = contactGroups.map(async (contacts) => {
      try {
        const results = await this.hubspotClient.crm.contacts.batchApi.create({
          inputs: contacts.map(c => ({
            properties: contactToHubspotProperties(c.properties)
          }))
        });

        const createdContacts: Contact[] = contacts.map(contact => {
          const result = results.body.results.find(result =>
            result.properties.email === contact.properties.email);
          assert.ok(result);
          return {
            ...contact.properties,
            otherEmails: [],
            hs_object_id: result.id,
          };
        });

        log.info('Live Uploader', 'Created Contacts:', createdContacts);

        return createdContacts;
      }
      catch (e: any) {
        throw new Error(e.response.body.message);
      }
    });
    const contactResultGroups = await Promise.all(promises);
    return contactResultGroups.flat(1);
  }

  async updateAllContacts(contacts: Array<{ id: string; properties: Partial<GeneratedContact> }>) {
    log.info('Live Uploader', 'Updating Contacts:', contacts);

    const contactGroups = batchesOf(contacts, 10);
    const promises = contactGroups.map(async (contacts) => {
      try {
        await this.hubspotClient.crm.contacts.batchApi.update({
          inputs: contacts.map(c => {
            return {
              id: c.id,
              properties: contactToHubspotProperties(c.properties),
            };
          })
        });
        log.info('Live Uploader', 'Updated Contacts:', contacts.length);
      }
      catch (e: any) {
        throw new Error(e.response.body.message);
      }
    });
    await Promise.all(promises);
  }

  async updateAllCompanies(companies: Array<{ id: string; properties: Partial<Omit<Company, 'id'>> }>) {
    log.info('Live Uploader', 'Updating Companies:', companies);

    const companyGroups = batchesOf(companies, 10);
    const promises = companyGroups.map(async (companies) => {
      try {
        await this.hubspotClient.crm.companies.batchApi.update({
          inputs: companies.map(company => {
            const properties: { [key: string]: string } = {};

            for (const [key, val] of Object.entries(company.properties)) {
              if (val) properties[key] = val;
            }

            return {
              id: company.id,
              properties,
            };
          })
        });
        log.info('Live Uploader', 'Updated Companies:', companies.length);
      }
      catch (e: any) {
        throw new Error(e.response.body.message);
      }
    });
    await Promise.all(promises);
  }

  async createAllDeals(deals: Omit<Deal, 'id'>[]): Promise<Deal[]> {
    log.info('Live Uploader', 'Creating Deals:', deals);

    const dealGroups = batchesOf(deals, 10);
    const promises = dealGroups.map(async (deals, i) => {
      try {
        saveToJson(`hubspot-create-deals-in-${i}.json`, deals);

        const results = await this.hubspotClient.crm.deals.batchApi.create({
          inputs: deals.map(({ properties }) => {
            const { addonLicenseId, transactionId, ...rest } = properties;
            return {
              properties: {
                [config.hubspot.attrs.deal.addonLicenseId]: addonLicenseId,
                [config.hubspot.attrs.deal.transactionId]: transactionId,
                ...rest,
              },
            };
          })
        });

        saveToJson(`hubspot-create-deals-out-${i}.json`, results.body.results);

        const createdDeals: Deal[] = deals.map(deal => {
          const result = results.body.results.find(result =>
            result.properties[config.hubspot.attrs.deal.addonLicenseId] === deal.properties.addonLicenseId ||
            result.properties[config.hubspot.attrs.deal.transactionId] === deal.properties.transactionId
          );
          assert.ok(result);
          return { ...deal, id: result.id };
        });

        log.info('Live Uploader', 'Created Deals:', createdDeals);

        return createdDeals;
      }
      catch (e: any) {
        throw new Error(e.response.body.message);
      }
    });
    const dealResultGroups = await Promise.all(promises);
    return dealResultGroups.flat(1);
  }

  async updateAllDeals(deals: DealUpdate[]) {
    log.info('Live Uploader', 'Updating Deals:', deals);

    const dealGroups = batchesOf(deals, 10);
    const promises = dealGroups.map(async (deals, i) => {
      try {
        saveToJson(`hubspot-update-deals-in-${i}.json`, deals);

        const results = await this.hubspotClient.crm.deals.batchApi.update({
          inputs: deals.map(({ properties, id }) => {
            const { addonLicenseId, transactionId, ...rest } = properties;
            return {
              id,
              properties: {
                [config.hubspot.attrs.deal.addonLicenseId]: addonLicenseId,
                [config.hubspot.attrs.deal.transactionId]: transactionId,
                ...rest,
              },
            };
          }),
        });

        saveToJson(`hubspot-update-deals-out-${i}.json`, results.body.results);

        log.info('Live Uploader', 'Updated Deals:', deals.length);
      }
      catch (e: any) {
        throw new Error(e.response.body.message);
      }
    });
    await Promise.all(promises);
  }

}
