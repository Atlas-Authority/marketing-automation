import * as assert from 'assert';
import _ from 'lodash';
import mustache from 'mustache';
import config, { DealStage, Pipeline } from '../util/config.js';
import { isPresent, sorter } from '../util/helpers.js';
import { saveForInspection } from '../util/inspection.js';
import * as logger from '../util/logger.js';
import { interpretAsEvents } from './deal-generator/events.js';
import { calculateTierFromLicenseContext } from './tiers.js';

function dealPropertiesForLicense(license: License, transactions: Transaction[]): Omit<Deal['properties'], 'dealstage'> {
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

function contactIdsForLicense(contacts: ContactsByEmail, license: License) {
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

export function generateDeals(data: {
  allMatches: RelatedLicenseSet[],
  initialDeals: Deal[],
  contactsByEmail: ContactsByEmail,
  providerDomains: Set<string>,
  partnerDomains: Set<string>,
}) {
  const { dealCreateActions, dealUpdateActions } = generateDealActions({
    matches: data.allMatches
      .filter(group =>
        group.some(m =>
          !olderThan90Days(m.license.maintenanceStartDate))),
    initialDeals: data.initialDeals,
    providerDomains: data.providerDomains,
    partnerDomains: data.partnerDomains,
  });

  const dealsToCreate: Omit<Deal, 'id'>[] = dealCreateActions.map(({ license, transactions, dealstage, amount }) => {
    const contactIds = contactIdsForLicense(data.contactsByEmail, license);
    const generatedProperties = dealPropertiesForLicense(license, transactions);
    const properties = {
      ...generatedProperties,
      amount,
      dealstage,
    };
    return { contactIds, properties };
  });

  const dealsToUpdate: DealUpdate[] = [];

  const associationsToCreate: Array<{ contactId: string, dealId: string }> = [];
  const associationsToRemove: Array<{ contactId: string, dealId: string }> = [];

  for (const { id, properties, license, transactions } of dealUpdateActions) {
    const oldDeal = data.initialDeals.find(oldDeal => oldDeal.id === id);
    assert.ok(oldDeal);

    let newDeal: DealUpdate;

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
      const typedKey = key as keyof Deal['properties'];
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

type DealUpdateAction = {
  id: string,
  license?: License,
  transactions: Transaction[],
  properties: {
    addonlicenseid: Deal['properties']['addonlicenseid'],
    closedate?: Deal['properties']['closedate'],
    amount?: Deal['properties']['amount'],
    dealstage?: Deal['properties']['dealstage'],
  },
};

type DealCreateAction = {
  dealstage: DealStage,
  license: License,
  transactions: Transaction[],
  amount: string,
};

/** Generates deal actions based on match data */
class DealActionGenerator {

  dealCreateActions: DealCreateAction[] = [];
  dealUpdateActions: DealUpdateAction[] = [];

  ignoredLicenseSets: (License & { reason: string })[][] = [];

  allTransactionDeals = new Map<string, Deal>();
  allLicenseDeals = new Map<string, Deal>();

  constructor(private providerDomains: Set<string>, private partnerDomains: Set<string>, initialDeals: Deal[]) {
    this.providerDomains = providerDomains;
    this.partnerDomains = partnerDomains;

    for (const deal of initialDeals) {
      if (deal.properties.addonlicenseid) {
        this.allLicenseDeals.set(deal.properties.addonlicenseid, deal);
      }
      if (deal.properties.transactionid) {
        this.allLicenseDeals.set(deal.properties.transactionid, deal);
      }
    }
  }

  generateActionsForMatchedGroup(groups: RelatedLicenseSet) {
    assert.ok(groups.length > 0);
    if (this.ignoring(groups)) return;

    /** Licenses in this group */
    const licenses = (groups
      .map(g => g.license)
      .sort(sorter(l => l.maintenanceStartDate, 'ASC'))
    );

    const events = interpretAsEvents(groups);

    const licenseDeals = new Set<Deal>();
    for (const license of licenses) {
      const deal = this.allLicenseDeals.get(license.addonLicenseId);
      if (deal) licenseDeals.add(deal);
    }

    const transactionDeals = new Set<Deal>();
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
    for (const event of events) {

      switch (event.type) {
        case 'eval':

          switch (hosting) {
            case 'Server':
            case 'Data Center':
              // If existing eval deal:
              //   Update CloseDate
              // Else:
              //   Create Eval
              break;
            case 'Cloud':
              // If no existing eval deal:
              //   Create Eval
              break;
          }

          break;
        case 'purchase':

          switch (hosting) {
            case 'Server':
            case 'Data Center':
              break;
            case 'Cloud':
              break;
          }

          break;
        case 'renewal':
        case 'upgrade':

          switch (hosting) {
            case 'Server':
            case 'Data Center':
              break;
            case 'Cloud':
              break;
          }

          break;
        case 'refund':
          break;
      }

    }

    let deal = licenseDeals.size > 0 ? [...licenseDeals][0] : null;

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

  /** Ignore if every license's tech contact domain is partner or mass-provider */
  ignoring(groups: RelatedLicenseSet) {
    const licenses = groups.map(g => g.license);
    const domains = licenses.map(license => license.contactDetails.technicalContact.email.toLowerCase().split('@')[1]);
    const badDomains = domains.filter(domain => this.partnerDomains.has(domain) || this.providerDomains.has(domain));

    if (badDomains.length === licenses.length) {
      this.ignoreLicenses('bad-domains:' + _.uniq(badDomains).join(','), licenses);
      return true;
    }

    return false;
  }

  ignoreLicenses(reason: string, licenses: License[]) {
    this.ignoredLicenseSets.push(licenses.map(license => ({ reason, ...license })));
  }

}

function generateDealActions(data: {
  matches: RelatedLicenseSet[],
  initialDeals: Deal[],
  providerDomains: Set<string>,
  partnerDomains: Set<string>,
}) {
  const generator = new DealActionGenerator(data.providerDomains, data.partnerDomains, data.initialDeals);

  // Stages:
  // 1. Sort and normalize licenses/transactions (event records)
  // 2. Turn event records into deal-generating-relevant events
  // 3. Match events up with deal state and generate actions

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

function isFreeLicense(license: License) {
  return license.licenseType === 'EVALUATION' || license.licenseType === 'OPEN_SOURCE';
}

export function olderThan90Days(dateString: string) {
  const now = Date.now();
  const then = new Date(dateString).getTime();
  return (now - then > NINETY_DAYS_AS_MS);
}
