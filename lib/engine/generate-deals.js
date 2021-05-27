import * as assert from 'assert';
import _ from 'lodash';
import mustache from 'mustache';
import config, { DealStage, Pipeline } from '../util/config.js';
import { isPresent, sorter } from '../util/helpers.js';
import { saveForInspection } from '../util/inspection.js';
import * as logger from '../util/logger.js';
import { calculateTierFromLicenseContext } from './tiers.js';

/**
 * @param {License} license
 * @param {Transaction[]} transactions
 * @returns {Omit<Deal['properties'], 'dealstage'>}
 */
function dealPropertiesForLicense(license, transactions) {
  const tiers = calculateTierFromLicenseContext({ license, transactions });
  const tier = Math.max(...tiers);

  return {
    addonlicenseid: license.addonLicenseId,
    closedate: license.maintenanceEndDate,
    deployment: license.hosting,
    aa_app: license.addonKey,
    license_tier: tier.toFixed(),
    country: license.contactDetails.country,
    origin: config.constants.dealOrigin,
    related_products: config.constants.dealRelatedProducts,
    dealname: mustache.render(config.constants.dealDealName, { license }),
    pipeline: Pipeline.AtlassianMarketplace,
  };
}

/**
 * @param {ContactsByEmail} contacts
 * @param {License} license
 * @returns {string[]}
 */
function contactIdsForLicense(contacts, license) {
  const techEmail = license.contactDetails.technicalContact.email;
  const billingEmail = license.contactDetails.billingContact?.email;
  const partnerEmail = license.partnerDetails?.billingContact?.email;

  const techContact = contacts[techEmail];
  const billingContact = billingEmail ? contacts[billingEmail] : undefined;
  const partnerContact = partnerEmail ? contacts[partnerEmail] : undefined;

  return _.uniq([
    techContact?.hs_object_id,
    billingContact?.hs_object_id,
    partnerContact?.hs_object_id,
  ].filter(isPresent));
}

/**
 * @param {object} data
 * @param {RelatedLicenseSet[]} data.allMatches
 * @param {Deal[]} data.initialDeals
 * @param {ContactsByEmail} data.contactsByEmail
 * @param {Set<string>} data.providerDomains
 */
export function generateDeals(data) {
  const { dealCreateActions, dealUpdateActions } = generateDealActions({
    matches: data.allMatches
      .filter(group =>
        group.some(m =>
          !olderThan90Days(m.license.maintenanceStartDate))),
    initialDeals: data.initialDeals,
    providerDomains: data.providerDomains,
  });

  /** @type {Omit<Deal, 'id'>[]} */
  const dealsToCreate = dealCreateActions.map(({ license, transactions, dealstage, amount }) => {
    const contactIds = contactIdsForLicense(data.contactsByEmail, license);
    const properties = dealPropertiesForLicense(license, transactions);
    if (amount !== undefined) properties.amount = amount;
    return {
      contactIds,
      properties: {
        ...properties,
        dealstage,
      }
    };
  });

  /** @type {DealUpdate[]} */
  const dealsToUpdate = [];

  /** @type {Array<{ contactId: string, dealId: string }>} */
  const associationsToCreate = [];

  /** @type {Array<{ contactId: string, dealId: string }>} */
  const associationsToRemove = [];

  for (const { id, properties, license, transactions } of dealUpdateActions) {
    const oldDeal = data.initialDeals.find(oldDeal => oldDeal.id === id);
    assert.ok(oldDeal);

    /** @type {DealUpdate} */
    let newDeal;

    if (license) {
      // Start with deal->contact associations

      const oldAssociatedContactIds = oldDeal['contactIds'];
      const newAssociatedContactIds = contactIdsForLicense(data.contactsByEmail, license);
      assert.ok(newAssociatedContactIds);

      const creatingAssociatedContactIds = newAssociatedContactIds.filter(id => !oldAssociatedContactIds.includes(id));
      const removingAssociatedContactIds = oldAssociatedContactIds.filter(id => !newAssociatedContactIds.includes(id));

      if (creatingAssociatedContactIds.length > 0) associationsToCreate.push(...creatingAssociatedContactIds.map(contactId => ({ contactId, dealId: oldDeal.id })));
      if (removingAssociatedContactIds.length > 0) associationsToRemove.push(...removingAssociatedContactIds.map(contactId => ({ contactId, dealId: oldDeal.id })));

      // Now deal with deal

      const generatedProperties = dealPropertiesForLicense(license, transactions);
      newDeal = {
        id,
        properties: {
          ...generatedProperties,
          ...properties,
        },
      };
    }
    else {
      newDeal = { id, properties };
    }

    for (const [key, val] of Object.entries(newDeal.properties)) {
      const typedKey = /** @type {keyof Deal['properties']} */(key);
      if (val === oldDeal.properties[typedKey]) {
        delete newDeal.properties[typedKey];
      }
    }

    if (Object.keys(newDeal.properties).length > 0) {
      dealsToUpdate.push(newDeal);
    }
  }

  return { dealsToCreate, dealsToUpdate, associationsToCreate, associationsToRemove };
}

/**
 * @typedef DealUpdateAction
 * @property {string} id
 * @property {License=} license
 * @property {Transaction[]} transactions
 * @property {Partial<Deal['properties']>} properties
 */

/**
 * @typedef DealCreateAction
 * @property {DealStage} dealstage
 * @property {License} license
 * @property {Transaction[]} transactions
 * @property {string=} amount
 */

/**
 * @param {object} data
 * @param {RelatedLicenseSet[]} data.matches
 * @param {Deal[]} data.initialDeals
 * @param {Set<string>} data.providerDomains
 */
function generateDealActions(data) {
  /** @type {DealCreateAction[]} */
  const dealCreateActions = [];

  /** @type {DealUpdateAction[]} */
  const dealUpdateActions = [];

  /** @type {(License & {reason:string})[][]} */
  const ignoredLicenseSets = [];

  /**
   * @param {string} reason
   * @param {License[]} licenses
   */
  const ignoreLicenses = (reason, licenses) => {
    ignoredLicenseSets.push(licenses.map(license => ({ reason, ...license })));
  };

  // For each group of associated licenses (based on our matching engine)
  for (const relatedLicenseIds of data.matches) {
    const groups = relatedLicenseIds;

    /** Licenses in this group */
    const licenses = (groups
      .map(g => g.license)
      .sort(sorter(l => l.maintenanceStartDate, 'ASC'))
    );

    const badDomains = getBadDomains(licenses, data.providerDomains);
    if (badDomains.length === licenses.length) {
      ignoreLicenses('bad-domains:' + _.uniq(badDomains).join(','), licenses);
      continue;
    }

    /** Deals existing for licenses in this group */
    const deals = _.uniqBy(
      licenses
        .map(l => data.initialDeals
          .find(d => l.addonLicenseId === d.properties.addonlicenseid))
        .filter(isPresent),
      d => d.id);

    if (deals.length > 1) {
      if (config.isProduction) {
        logger.error('Deal Actions', 'Found duplicate deals', { deals, licenses });
        assert.fail('Found duplicate deals for above match');
      }
      else {
        // During dev, just log and then pick one as the main
        logger.warn('Deal Actions', 'Found duplicate deals');
      }
    }

    let deal = deals.length > 0 ? deals[0] : null;

    if (licenses.every(l => l.licenseType === 'EVALUATION')) {
      // It's only evals
      assert.ok(groups.flatMap(g => g.transactions).length === 0);

      const latestLicense = licenses[licenses.length - 1];

      if (deal) {
        // Deal exists, update it

        if (latestLicense.status === 'active') {
          if (
            latestLicense.maintenanceEndDate !== deal.properties.closedate ||
            latestLicense.addonLicenseId !== deal.properties.addonlicenseid
          ) {
            dealUpdateActions.push({
              id: deal.id,
              transactions: groups.flatMap(g => g.transactions),
              properties: {
                addonlicenseid: latestLicense.addonLicenseId,
                closedate: latestLicense.maintenanceEndDate,
              },
            });
          }
          else {
            // Ignoring (not updating eval) because it already has the same close date
            ignoreLicenses("eval-up-to-date", licenses);
          }
        }
        else {
          dealUpdateActions.push({
            id: deal.id,
            transactions: groups.flatMap(g => g.transactions),
            properties: {
              addonlicenseid: latestLicense.addonLicenseId,
              dealstage: DealStage.CLOSED_LOST,
            },
          });
        }
      }
      else {
        // No deal for them yet.

        if (latestLicense.status === 'active') {
          dealCreateActions.push({
            dealstage: DealStage.EVAL,
            transactions: groups.flatMap(g => g.transactions),
            license: latestLicense,
          });
        }
        else {
          // Ignoring (not creating eval) because it's inactive
          ignoreLicenses("inactive-evals", licenses);
        }
      }

    }
    else {
      // Some (maybe all) are paid

      const isFirstEval = licenses[0].licenseType === 'EVALUATION';
      const firstFoundPaid = licenses.find(l => l.licenseType !== 'EVALUATION');

      if (isFirstEval && firstFoundPaid) {

        /** Transactions for this deal */
        const transactions = groups.flatMap(g => g.transactions);

        /** @type {number | undefined} */
        let price;

        if (transactions.length === 1) {
          price = transactions[0].purchaseDetails.vendorAmount;
        }
        else if (transactions.length > 1) {
          const txs = transactions.filter(t => firstFoundPaid.addonLicenseId === t.addonLicenseId);
          price = Math.max.apply(undefined, txs.map(t => t.purchaseDetails.vendorAmount));
        }

        const amount = price?.toFixed(2);

        if (deal) {
          dealUpdateActions.push({
            id: deal.id,
            license: firstFoundPaid,
            transactions: groups.flatMap(g => g.transactions),
            properties: {
              addonlicenseid: firstFoundPaid.addonLicenseId,
              dealstage: DealStage.CLOSED_WON,
              ...(amount !== undefined ? { amount } : {}),
            },
          });
        }
        else {
          dealCreateActions.push({
            dealstage: DealStage.CLOSED_WON,
            license: firstFoundPaid,
            transactions: groups.flatMap(g => g.transactions),
            ...(amount !== undefined ? { amount } : {}),
          });
        }

      }
      else {
        // All paid? Or paid first then eval?
        // Either way, we probably don't care.

        // Ignoring (not creating or updating) either because first isn't eval or there's no paid
        ignoreLicenses('first-non-eval', licenses);
      }
    }
  }

  saveForInspection('ignored', ignoredLicenseSets);

  return {
    dealCreateActions,
    dealUpdateActions,
  };
}

const NINETY_DAYS_AS_MS = (1000 * 60 * 60 * 24 * 90);

/**
 * @param {string} dateString
 */
export function olderThan90Days(dateString) {
  const now = Date.now();
  const then = new Date(dateString).getTime();
  return (now - then > NINETY_DAYS_AS_MS);
}


const PARTNER_DOMAINS = new Set(config.engine.partnerDomains.map(s => s.toLowerCase()));

/**
 * @param {License[]} licenses
 * @param {Set<string>} providerDomains
 */
function getBadDomains(licenses, providerDomains) {
  const domains = licenses.map(license => license.contactDetails.technicalContact.email.toLowerCase().split('@')[1]);
  return domains.filter(domain => PARTNER_DOMAINS.has(domain) || providerDomains.has(domain));
}
