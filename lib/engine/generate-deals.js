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

    /** @type {Map<string, Deal>} */
    this.allTransactionDeals = new Map();

    /** @type {Map<string, Deal>} */
    this.allLicenseDeals = new Map();

    for (const deal of initialDeals) {
      if (deal.properties.addonlicenseid) {
        this.allLicenseDeals.set(deal.properties.addonlicenseid, deal);
      }
      if (deal.properties.transactionid) {
        this.allLicenseDeals.set(deal.properties.transactionid, deal);
      }
    }
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

    /** @type {Set<Deal>} */
    const licenseDeals = new Set();
    for (const license of licenses) {
      const deal = this.allLicenseDeals.get(license.addonLicenseId);
      if (deal) licenseDeals.add(deal);
    }

    /** @type {Set<Deal>} */
    const transactionDeals = new Set();
    for (const transaction of groups.flatMap(g => g.transactions)) {
      const deal = this.allTransactionDeals.get(transaction.transactionId);
      if (deal) transactionDeals.add(deal);
    }

    // Hosting     State         Event              Action
    // ---------   -----------   ----------------   ----------------------------
    // Server/DC   No Deal       Eval               Create Eval
    // Server/DC   Eval Deal     Eval               Update Eval (CloseDate)
    // Server/DC   No Deal       Purchase           Create Won (Amount)
    // Server/DC   Eval Deal     Purchase           Close Won (Amount, CloseDate)
    // Server/DC                 Renew/Up/Down      Create Won (Amount)
    // Cloud       No Deal       Eval               Create Eval
    // Cloud                     Purchase           Create or Update Closed Won (CloseDate)
    // Cloud                     Renew/Up/Down      Create Won, (Amount)
    // Any         Closed Deal   All Txs Refunded   Update (CloseDate, Amount, Stage=Lost)

    const hosting = groups[0].license.hosting;
    for (const event of interpretAsEvents(groups)) {

      switch (event.type) {
        case 'eval':
          break;
        case 'purchase':
          break;
        case 'renewal':
        case 'upgrade':
          break;
        case 'refund':
          break;
      }

    }

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
 * @typedef RefundEvent
 * @property {'refund'} type
 * @property {string[]} refunded transaction IDs
 */

/**
 * @typedef EvalEvent
 * @property {'eval'} type
 * @property {License} license
 */

/**
 * @typedef PurchaseEvent
 * @property {'purchase'} type
 * @property {Transaction=} transaction
 * @property {License} license
 */

/**
 * @typedef RenewalEvent
 * @property {'renewal'} type
 * @property {Transaction} transaction
 */

/**
 * @typedef UpgradeEvent
 * @property {'upgrade'} type
 * @property {Transaction} transaction
 */

/**
 * @typedef {RefundEvent | EvalEvent | PurchaseEvent | RenewalEvent | UpgradeEvent} Event
 */

/**
 * @param {LicenseContext[]} groups
 */
function interpretAsEvents(groups) {
  /** @type {Event[]} */
  const events = [];

  const records = groups.flatMap(group => {
    let transactions = group.transactions;

    /** @type {string[]} */
    const refundedTxIds = [];

    // Try to create events out of refunds
    for (const transaction of transactions) {
      if (transaction.purchaseDetails.saleType === 'Refund') {
        const sameDayTransactions = (transactions
          .filter(other =>
            other.purchaseDetails.maintenanceStartDate === transaction.purchaseDetails.maintenanceStartDate &&
            other.purchaseDetails.saleType !== 'Refund'
          )
          .sort(sorter(tx =>
            tx.purchaseDetails.maintenanceStartDate
          ))
        );

        const fullyRefundedTx = sameDayTransactions.find(other =>
          other.purchaseDetails.vendorAmount ===
          -transaction.purchaseDetails.vendorAmount
        );

        if (fullyRefundedTx) {
          refundedTxIds.push(fullyRefundedTx.transactionId);

          // Remove it from the list
          transactions = transactions.filter(tx =>
            tx !== transaction && tx !== fullyRefundedTx
          );
        }
        else {
          const partiallyRefundedTx = sameDayTransactions.find(other =>
            other.purchaseDetails.vendorAmount >
            Math.abs(transaction.purchaseDetails.vendorAmount)
          );

          if (partiallyRefundedTx) {
            // Apply partial refund on first found transaction
            partiallyRefundedTx.purchaseDetails.vendorAmount += transaction.purchaseDetails.vendorAmount;
            transactions = transactions.filter(tx => tx !== transaction);
          }
          else {
            // TODO: Check on a near date instead of this date
          }
        }

        if (transactions.length === 0) {
          events.push({
            type: 'refund',
            refunded: refundedTxIds,
          });
        }
      }
    }

    /** @type {(License | Transaction)[]} */
    const records = [...transactions];

    // Include the License unless it's based on a 'New' Transaction
    if (!transactions.some(t => t.purchaseDetails.saleType === 'New')) {
      records.push(group.license);
    }

    return records;
  });

  sortRecords(records);

  const tempEvent = new TempEvent(events);

  for (const record of records) {
    if (
      tempEvent.event === undefined &&
      isLicense(record) &&
      (
        record.licenseType === 'EVALUATION' ||
        record.licenseType === 'OPEN_SOURCE'
      )
    ) {
      tempEvent.use({ type: 'eval', license: record });
    }
    else if (
      (isLicense(record) && isPaidLicense(record)) ||
      (!isLicense(record) && record.purchaseDetails.saleType === 'New')
    ) {
      if (isLicense(record)) {
        tempEvent.use({ type: 'purchase', license: record });
      }
      else {
        const license = (groups
          .map(g => g.license)
          .filter(l => l.addonLicenseId === record.addonLicenseId)[0]);
        tempEvent.use({ type: 'purchase', license, transaction: record });
      }
    }
    else if (!isLicense(record)) {
      switch (record.purchaseDetails.saleType) {
        case 'Renewal':
          events.push({ type: 'renewal', transaction: record });
          break;
        case 'Upgrade':
          events.push({ type: 'upgrade', transaction: record });
          break;
      }
    }
  }

  tempEvent.finalize();

  for (const record of records) {
    const output = (isLicense(record)
      ? {
        sen: record.addonLicenseId,
        date: record.maintenanceStartDate,
        type: record.licenseType,
      }
      : {
        sen: record.addonLicenseId,
        date: record.purchaseDetails.maintenanceStartDate,
        type: record.purchaseDetails.licenseType,
        sale: record.purchaseDetails.saleType,
        at: record.transactionId,
        amt: record.purchaseDetails.vendorAmount,
      });
    console.dir(output, { breakLength: Infinity, depth: null });
  }
  console.log('---');
  for (const e of events) {
    switch (e.type) {
      case 'eval': console.dir({ type: e.type, id: e.license.addonLicenseId }, { breakLength: Infinity }); break;
      case 'purchase': console.dir({ type: e.type, id: e.license.addonLicenseId }, { breakLength: Infinity }); break;
      case 'refund': console.dir({ type: e.type, id: e.refunded[0] }, { breakLength: Infinity }); break;
      case 'renewal': console.dir({ type: e.type, id: e.transaction.transactionId }, { breakLength: Infinity }); break;
      case 'upgrade': console.dir({ type: e.type, id: e.transaction.transactionId }, { breakLength: Infinity }); break;
    }
  }
  console.log('\n\n\n');

  return events;
}

/**
 * @template {License | Transaction} T
 * @param {T} record
 * @returns {record is License}
 */
function isLicense(record) {
  return 'maintenanceStartDate' in record;
}

/**
 * @param {License} license
 */
function isPaidLicense(license) {
  return (
    license.licenseType === 'ACADEMIC' ||
    license.licenseType === 'COMMERCIAL' ||
    license.licenseType === 'COMMUNITY' ||
    license.licenseType === 'DEMONSTRATION'
  );
}

/**
 * @param {(License | Transaction)[]} records
 */
function sortRecords(records) {

  /**
   * @param {License | Transaction} record
   */
  function getDate(record) {
    return isLicense(record)
      ? record.maintenanceStartDate
      : record.purchaseDetails.maintenanceStartDate;
  }

  /**
   * @param {License | Transaction} record
   */
  function getLicenseType(record) {
    return isLicense(record)
      ? record.licenseType
      : record.purchaseDetails.licenseType;
  }

  records.sort((a, b) => {
    // First sort by date
    const date1 = getDate(a);
    const date2 = getDate(b);
    if (date1 < date2) return -1;
    if (date1 > date2) return 1;

    // Evals on the same date always go before other transactions
    const type1 = getLicenseType(a);
    const type2 = getLicenseType(b);
    if (type1 === 'EVALUATION' && type2 !== 'EVALUATION') return -1;
    if (type1 !== 'EVALUATION' && type2 === 'EVALUATION') return -1;

    return 0;
  });

}

class TempEvent {

  /** @type {EvalEvent | PurchaseEvent | undefined} */
  event;

  /** @type {number} */
  insertIndex = -1;

  /**
   * @param {Event[]} events
   */
  constructor(events) {
    this.events = events;
  }

  /**
   * @param {EvalEvent | PurchaseEvent} event
   */
  use(event) {
    if (this.insertIndex === -1) {
      this.insertIndex = this.events.length;
    }
    this.event = event;
  }

  finalize() {
    if (this.event) {
      this.events.splice(this.insertIndex, 0, this.event);
    }
  }
}
