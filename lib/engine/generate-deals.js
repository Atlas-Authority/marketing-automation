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

  const firstPaidTransaction = (
    transactions
      .sort(sorter(tx => tx.purchaseDetails.saleDate, 'ASC'))
      .find(tx => tx.purchaseDetails.saleType !== 'Refund')
  );

  const amount = firstPaidTransaction?.purchaseDetails.vendorAmount ?? 0;

  return {
    addonlicenseid: license.addonLicenseId,
    transactionid: '',
    closedate: (
      transactions.map(tx => tx.purchaseDetails.saleDate).sort()[0]
      || license.maintenanceStartDate),
    deployment: license.hosting,
    aa_app: license.addonKey,
    license_tier: tier.toFixed(),
    country: license.contactDetails.country,
    origin: config.constants.dealOrigin,
    related_products: config.constants.dealRelatedProducts,
    dealname: mustache.render(config.constants.dealDealName, { license }),
    pipeline: Pipeline.AtlassianMarketplace,
    amount: amount.toString(),
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
 * @param {Set<string>} data.partnerDomains
 */
export function generateDeals(data) {
  const { dealCreateActions, dealUpdateActions } = generateDealActions({
    matches: data.allMatches
      .filter(group =>
        group.some(m =>
          !olderThan90Days(m.license.maintenanceStartDate))),
    initialDeals: data.initialDeals,
    providerDomains: data.providerDomains,
    partnerDomains: data.partnerDomains,
  });

  /** @type {Omit<Deal, 'id'>[]} */
  const dealsToCreate = dealCreateActions.map(({ license, transactions, dealstage, amount }) => {
    const contactIds = contactIdsForLicense(data.contactsByEmail, license);
    const generatedProperties = dealPropertiesForLicense(license, transactions);
    const properties = {
      ...generatedProperties,
      amount,
      dealstage,
    };
    return { contactIds, properties };
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
 * @property {object} properties
 * @property {Deal['properties']['addonlicenseid']} properties.addonlicenseid
 * @property {Deal['properties']['closedate']=} properties.closedate
 * @property {Deal['properties']['amount']=} properties.amount
 * @property {Deal['properties']['dealstage']=} properties.dealstage
 */

/**
 * @typedef DealCreateAction
 * @property {DealStage} dealstage
 * @property {License} license
 * @property {Transaction[]} transactions
 * @property {string} amount
 */

/** Generates deal actions based on match data */
class DealActionGenerator {

  /** @type {DealCreateAction[]} */
  dealCreateActions = [];

  /** @type {DealUpdateAction[]} */
  dealUpdateActions = [];

  /** @type {(License & {reason:string})[][]} */
  ignoredLicenseSets = [];

  /**
   * @param {Set<string>} providerDomains
   * @param {Set<string>} partnerDomains
   * @param {Deal[]} initialDeals
   */
  constructor(providerDomains, partnerDomains, initialDeals) {
    this.providerDomains = providerDomains;
    this.partnerDomains = partnerDomains;
    this.initialDeals = initialDeals;
  }

  /**
   * @param {RelatedLicenseSet} groups
   */
  generateActionsForMatchedGroup(groups) {
    assert.ok(groups.length > 0);

    /** Licenses in this group */
    const licenses = (groups
      .map(g => g.license)
      .sort(sorter(l => l.maintenanceStartDate, 'ASC'))
    );

    // If every license's tech contact domain is partner/mass-provider, ignore this license set
    const badDomains = getBadDomains(licenses, this.providerDomains, this.partnerDomains);
    if (badDomains.length === licenses.length) {
      this.ignoreLicenses('bad-domains:' + _.uniq(badDomains).join(','), licenses);
      return;
    }

    /** Deals existing for licenses in this group */
    const deals = _.uniqBy(
      licenses
        .map(l => this.initialDeals
          .find(d => l.addonLicenseId === d.properties.addonlicenseid))
        .filter(isPresent),
      d => d.id);

    // TODO: Allow multiple deals, to cover Renewals/Upgrades/Downgrades.
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

    /**
     * If Server/DC & Eval     & No Deal:   Create Eval
     * If Server/DC & Eval     & Eval Deal: Update Eval (CloseDate)
     * If Server/DC & Purchase & No Deal:   Create Won (Amount)
     * If Server/DC & Purchase & Eval Deal: Close Won (Amount, CloseDate)
     * If Server/DC & Renew/Up/Down:        Create Won (Amount)
     * If Cloud & Eval & No Deal:           Create Eval
     * If Cloud & Purchase:                 Create or Update Closed Won (CloseDate)
     * If Cloud & Renew/Up/Down:            Create Won, (Amount)
     * If All Txs Refunded & Closed Deal:   Update (CloseDate, Amount, Stage=Lost)
     */

    if (deal && isClosedDeal(deal) && allRefunded(groups)) {
      // TODO: Update (CloseDate, Amount, Stage=Lost)
    }
    else if (someRefunded(groups)) {
      // TODO: Remove Refunds & Refunded Transactions
    }

    for (const tx of getTransactionsThatAlwaysCreateNewDeals(groups)) {
      // TODO: Create Won (Amount)
      // TODO: Trace transaction via deal.addonlicenseid so we don't recreate the same deal.
    }

    const hosting = groups[0].license.hosting;

    switch (hosting) {
      case 'Server':
      case 'Data Center':
        if (deal === null) {
          if (hasPurchase(groups)) {
            // TODO: Create Won (Amount)
          }
          else if (hasEval(groups)) {
            // TODO: Create Eval
          }
        }
        else if (deal.properties.dealstage === DealStage.EVAL) {
          if (hasPurchase(groups)) {
            // TODO: Close Won (Amount, CloseDate)
          }
          else if (hasEval(groups)) {
            // TODO: Update Eval (CloseDate)
          }
        }

        break;
      case 'Cloud':
        if (hasPurchase(groups)) {
          if (deal === null) {
            // TODO: Create Won (CloseDate)
          }
          else if (deal.properties.dealstage === DealStage.EVAL) {
            // TODO: Close Won (CloseDate)
          }
        }
        else if (hasEval(groups)) {
          if (deal === null) {
            // TODO: Create Eval
          }
        }

        break;
    }

    if (licenses.every(l => isFreeLicense(l))) {
      // It's only evals
      assert.ok(groups.flatMap(g => g.transactions).length === 0);

      const latestLicense = licenses[licenses.length - 1];

      if (deal) {
        // Deal exists, update it

        if (latestLicense.status === 'active') {
          const closeDate = (groups
            .flatMap(tx => tx.transactions)
            .map(tx => tx.purchaseDetails.saleDate)
            .sort()[0] || latestLicense.maintenanceStartDate);

          if (
            closeDate !== deal.properties.closedate ||
            latestLicense.addonLicenseId !== deal.properties.addonlicenseid
          ) {
            this.dealUpdateActions.push({
              id: deal.id,
              transactions: groups.flatMap(g => g.transactions),
              properties: {
                addonlicenseid: latestLicense.addonLicenseId,
                closedate: closeDate,
              },
            });
          }
          else {
            // Ignoring (not updating eval) because it already has the same close date
            this.ignoreLicenses("eval-up-to-date", licenses);
          }
        }
        else {
          this.dealUpdateActions.push({
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
          this.dealCreateActions.push({
            dealstage: DealStage.EVAL,
            transactions: groups.flatMap(g => g.transactions),
            license: latestLicense,
            amount: '0',
          });
        }
        else {
          // Ignoring (not creating eval) because it's inactive
          this.ignoreLicenses("inactive-evals", licenses);
        }
      }

    }
    else {
      // Some (maybe all) are paid

      const isFirstEval = isFreeLicense(licenses[0]);
      const firstFoundPaid = licenses.find(l => !isFreeLicense(l));

      /** Transactions for this deal */
      const transactions = (groups
        .flatMap(g => g.transactions)
        .filter(tx => tx.purchaseDetails.saleType !== 'Refund')
        .sort(sorter(tx => tx.purchaseDetails.saleDate))
      );

      let price = (transactions
        .find(tx => tx) // just return first, if any exists
        ?.purchaseDetails
        .vendorAmount);

      if (firstFoundPaid) {
        if (isFirstEval) {
          if (deal) {
            this.dealUpdateActions.push({
              id: deal.id,
              license: firstFoundPaid,
              transactions,
              properties: {
                addonlicenseid: firstFoundPaid.addonLicenseId,
                dealstage: DealStage.CLOSED_WON,
                ...(price && { amount: price.toFixed(2) }),
              },
            });
          }
          else {
            this.dealCreateActions.push({
              dealstage: DealStage.CLOSED_WON,
              license: firstFoundPaid,
              transactions,
              amount: (price ?? 0).toFixed(2),
            });
          }
        }
        else {
          if (deal) {
            // Only close/update evals, leave closed deals alone
            if (deal.properties.dealstage === DealStage.EVAL) {
              this.dealUpdateActions.push({
                id: deal.id,
                license: firstFoundPaid,
                transactions,
                properties: {
                  addonlicenseid: firstFoundPaid.addonLicenseId,
                  dealstage: DealStage.CLOSED_WON,
                  ...(price && { amount: price.toFixed(2) }),
                },
              });
            }
          }
          else {
            this.dealCreateActions.push({
              dealstage: DealStage.CLOSED_WON,
              license: firstFoundPaid,
              transactions: transactions,
              amount: (price ?? 0).toFixed(2),
            });
          }
        }
      }

    }

  }

  /**
   * @param {string} reason
   * @param {License[]} licenses
   */
  ignoreLicenses(reason, licenses) {
    this.ignoredLicenseSets.push(licenses.map(license => ({ reason, ...license })));
  }

}

/**
 * @param {object} data
 * @param {RelatedLicenseSet[]} data.matches
 * @param {Deal[]} data.initialDeals
 * @param {Set<string>} data.providerDomains
 * @param {Set<string>} data.partnerDomains
 */
function generateDealActions(data) {
  const generator = new DealActionGenerator(data.providerDomains, data.partnerDomains, data.initialDeals);

  for (const relatedLicenseIds of data.matches) {
    generator.generateActionsForMatchedGroup(relatedLicenseIds);
  }

  saveForInspection('ignored', generator.ignoredLicenseSets);

  return {
    dealCreateActions: generator.dealCreateActions,
    dealUpdateActions: generator.dealUpdateActions,
  };
}

const NINETY_DAYS_AS_MS = (1000 * 60 * 60 * 24 * 90);

/**
 * @param {License} license
 */
function isFreeLicense(license) {
  return license.licenseType === 'EVALUATION' || license.licenseType === 'OPEN_SOURCE';
}

/**
 * @param {string} dateString
 */
export function olderThan90Days(dateString) {
  const now = Date.now();
  const then = new Date(dateString).getTime();
  return (now - then > NINETY_DAYS_AS_MS);
}


/**
 * @param {License[]} licenses
 * @param {Set<string>} providerDomains
 * @param {Set<string>} partnerDomains
 */
function getBadDomains(licenses, providerDomains, partnerDomains) {
  const domains = licenses.map(license => license.contactDetails.technicalContact.email.toLowerCase().split('@')[1]);
  return domains.filter(domain => partnerDomains.has(domain) || providerDomains.has(domain));
}

/**
 * @param {RelatedLicenseSet} groups
 */
function hasEval(groups) {
  return groups.some(g =>
    g.license.licenseType === 'EVALUATION');
}

/**
 * @param {RelatedLicenseSet} groups
 */
function hasPurchase(groups) {
  return groups.some(g =>
    g.transactions.some(tx =>
      tx.purchaseDetails.saleType === 'New'));
}

/**
 * @param {RelatedLicenseSet} groups
 */
function getTransactionsThatAlwaysCreateNewDeals(groups) {
  return groups.flatMap(g =>
    g.transactions.filter(tx =>
      tx.purchaseDetails.saleType === 'Upgrade' ||
      tx.purchaseDetails.saleType === 'Renewal'
    ));
}

/**
 * @param {Deal} deal
 */
function isClosedDeal(deal) {
  return (
    deal.properties.dealstage === DealStage.CLOSED_WON ||
    deal.properties.dealstage === DealStage.CLOSED_LOST
  );
}

/**
 * @param {RelatedLicenseSet} groups
 */
function allRefunded(groups) {
  return groups.every(g =>
    g.transactions.length === 0 ||
    isFullyRefunded(g.transactions)
  );
}

/**
 * @param {RelatedLicenseSet} groups
 */
function someRefunded(groups) {
  return (
    groups.some(g => isFullyRefunded(g.transactions)) &&
    !allRefunded(groups)
  );
}

/**
 * @param {Transaction[]} transactions
 */
function isFullyRefunded(transactions) {
  if (transactions.length === 0) return false;
  const refunds = transactions.filter(t => t.purchaseDetails.saleType === 'Refund');
  if (refunds.length === 0) return false;

  // TODO: Actually match them up
  return refunds.length === transactions.length / 2;
}
