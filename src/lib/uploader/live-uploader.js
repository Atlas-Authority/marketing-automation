import * as hubspot from '@hubspot/api-client';
import assert from 'assert';
import { contactToHubspotProperties } from '../engine/contacts.js';
import config from '../util/config.js';
import { batchesOf } from '../util/helpers.js';
import { saveToJson } from '../util/inspection.js';
import * as logger from '../util/logger.js';


/** @implements {Uploader} */
export default class LiveUploader {

  constructor() {
    this.hubspotClient = new hubspot.Client({ apiKey: config.hubspot.apiKey });
  }

  /**
   * @param {DealAssociationPair[]} fromTos
   */
  async associateDealsWithContacts(fromTos) {
    try {
      logger.info('Live Uploader', 'Associating Deals->Contacts:', fromTos);
      await this.hubspotClient.crm.associations.batchApi.create('deal', 'contact', {
        inputs: fromTos.map(({ dealId, contactId }) => ({
          from: { id: dealId },
          to: { id: contactId },
          type: 'deal_to_contact',
        })),
      });
    }
    catch (/** @type {any} */ e) {
      throw new Error(e.response.body.message);
    }
  }

  /**
   * @param {DealAssociationPair[]} fromTos
   */
  async disassociateDealsFromContacts(fromTos) {
    try {
      logger.info('Live Uploader', 'Disassociating Deals->Contacts:', fromTos);
      await this.hubspotClient.crm.associations.batchApi.archive('deal', 'contact', {
        inputs: fromTos.map(({ dealId, contactId }) => ({
          from: { id: dealId },
          to: { id: contactId },
          type: 'deal_to_contact',
        })),
      });
    }
    catch (/** @type {any} */ e) {
      throw new Error(e.response.body.message);
    }
  }

  /**
   * @param {Array<{ properties: GeneratedContact }>} contacts
   * @returns {Promise<Contact[]>}
   */
  async createAllContacts(contacts) {
    logger.info('Live Uploader', 'Creating Contacts:', contacts);

    const contactGroups = batchesOf(contacts, 10);
    const promises = contactGroups.map(async (contacts) => {
      try {
        const results = await this.hubspotClient.crm.contacts.batchApi.create({
          inputs: contacts.map(c => ({
            properties: contactToHubspotProperties(c.properties)
          }))
        });

        /** @type {Contact[]} */
        const createdContacts = contacts.map(contact => {
          const result = results.body.results.find(result =>
            result.properties.email === contact.properties.email);
          assert.ok(result);
          return {
            ...contact.properties,
            otherEmails: [],
            hs_object_id: result.id,
          };
        });

        logger.info('Live Uploader', 'Created Contacts:', createdContacts);

        return createdContacts;
      }
      catch (/** @type {any} */ e) {
        throw new Error(e.response.body.message);
      }
    });
    const contactResultGroups = await Promise.all(promises);
    return contactResultGroups.flat(1);
  }

  /**
   * @param {Array<{ id: string; properties: Partial<GeneratedContact> }>} contacts
   */
  async updateAllContacts(contacts) {
    logger.info('Live Uploader', 'Updating Contacts:', contacts);

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
        logger.info('Live Uploader', 'Updated Contacts:', contacts.length);
      }
      catch (/** @type {any} */ e) {
        throw new Error(e.response.body.message);
      }
    });
    await Promise.all(promises);
  }

  /**
   * @param {Array<{ id: string; properties: Partial<Omit<Company, 'id'>> }>} companies
   */
  async updateAllCompanies(companies) {
    logger.info('Live Uploader', 'Updating Companies:', companies);

    const companyGroups = batchesOf(companies, 10);
    const promises = companyGroups.map(async (companies) => {
      try {
        await this.hubspotClient.crm.companies.batchApi.update({
          inputs: companies.map(company => {
            /** @type {{ [key: string]: string }} */
            const properties = {};

            for (const [key, val] of Object.entries(company.properties)) {
              if (val) properties[key] = val;
            }

            return {
              id: company.id,
              properties,
            };
          })
        });
        logger.info('Live Uploader', 'Updated Companies:', companies.length);
      }
      catch (/** @type {any} */ e) {
        throw new Error(e.response.body.message);
      }
    });
    await Promise.all(promises);
  }

  /**
   * @param {Omit<Deal, 'id'>[]} deals
   * @returns {Promise<Deal[]>}
   */
  async createAllDeals(deals) {
    logger.info('Live Uploader', 'Creating Deals:', deals);

    const dealGroups = batchesOf(deals, 10);
    const promises = dealGroups.map(async (deals, i) => {
      try {
        saveToJson(`hubspot-create-deals-in-${i}.json`, deals);

        const results = await this.hubspotClient.crm.deals.batchApi.create({
          inputs: deals.map(({ properties }) => {
            const { addonlicenseid, transactionid, ...rest } = properties;
            return {
              properties: {
                [config.hubspot.attrs.deal.addonLicenseId]: addonlicenseid,
                [config.hubspot.attrs.deal.transactionId]: transactionid,
                ...rest,
              },
            };
          })
        });

        saveToJson(`hubspot-create-deals-out-${i}.json`, results.body.results);

        /** @type {Deal[]} */
        const createdDeals = deals.map(deal => {
          const result = results.body.results.find(result =>
            result.properties[config.hubspot.attrs.deal.addonLicenseId] === deal.properties.addonlicenseid ||
            result.properties[config.hubspot.attrs.deal.transactionId] === deal.properties.transactionid
          );
          assert.ok(result);
          return { ...deal, id: result.id };
        });

        logger.info('Live Uploader', 'Created Deals:', createdDeals);

        return createdDeals;
      }
      catch (/** @type {any} */ e) {
        throw new Error(e.response.body.message);
      }
    });
    const dealResultGroups = await Promise.all(promises);
    return dealResultGroups.flat(1);
  }

  /**
   * @param {DealUpdate[]} deals
   */
  async updateAllDeals(deals) {
    logger.info('Live Uploader', 'Updating Deals:', deals);

    const dealGroups = batchesOf(deals, 10);
    const promises = dealGroups.map(async (deals, i) => {
      try {
        saveToJson(`hubspot-update-deals-in-${i}.json`, deals);

        const results = await this.hubspotClient.crm.deals.batchApi.update({ inputs: deals });

        saveToJson(`hubspot-update-deals-out-${i}.json`, results.body.results);

        logger.info('Live Uploader', 'Updated Deals:', deals.length);
      }
      catch (/** @type {any} */ e) {
        throw new Error(e.response.body.message);
      }
    });
    await Promise.all(promises);
  }

}
