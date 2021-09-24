import * as assert from 'assert';
import _ from 'lodash';
import * as util from 'util';
import { Contact, ContactsByEmail } from '../types/contact.js';
import { License, LicenseContext } from '../types/license.js';
import { Transaction } from '../types/transaction.js';
import { fnOrCache } from '../util/fn-cache.js';
import { sorter } from '../util/helpers.js';
import { saveForInspection } from '../util/inspection.js';
import log from '../util/logger.js';
import { LicenseMatcher } from './license-matcher.js';


// Server/DC licenses have separate trial licenses.
// Cloud licenses do NOT have separate trial licenses; updated in place.


export function matchIntoLikelyGroups(data: {
  transactions: Transaction[],
  licenses: License[],
  providerDomains: Set<string>,
  contactsByEmail: ContactsByEmail,
}) {
  log.info('Scoring Engine', 'Storing licenses/transactions by id');
  const itemsByAddonLicenseId: { [addonLicenseId: string]: LicenseContext } = buildMappingStructure(data.contactsByEmail, data.transactions, data.licenses);

  log.info('Scoring Engine', 'Grouping licenses/transactions by hosting and addonKey');
  const productGroupings: { addonKey: string; hosting: string; group: License[] }[] = groupMappingByProduct(itemsByAddonLicenseId);

  const { maybeMatches, unaccounted } = fnOrCache('scorer.dat', () => {
    const scorer = new LicenseMatcher(data.providerDomains, data.contactsByEmail);
    return scoreLicenseMatches(productGroupings, scorer);
  });

  saveForInspection('match-scores-all', maybeMatches
    .sort(sorter(m => m.score, 'DSC'))
    .map(m => [
      { score: m.score, reasons: m.reasons.join(', '), ...shorterLicenseInfo(itemsByAddonLicenseId[m.item1].license) },
      { score: m.score, reasons: m.reasons.join(', '), ...shorterLicenseInfo(itemsByAddonLicenseId[m.item2].license) },
    ])
  );

  saveForInspection('match-scores-only-uncertain', maybeMatches
    .filter(m => m.score < 1000)
    .sort(sorter(m => m.score, 'DSC'))
    .map(m => [
      { score: m.score, reasons: m.reasons.join(', '), ...shorterLicenseInfo(itemsByAddonLicenseId[m.item1].license) },
      { score: m.score, reasons: m.reasons.join(', '), ...shorterLicenseInfo(itemsByAddonLicenseId[m.item2].license) },
    ])
  );

  log.info('Scoring Engine', 'Normalize license matches into groups over threshold');
  const normalizedMatches: { [addonLicenseId: string]: Set<string> } = normalizeMatches(maybeMatches, 130);

  // Re-add non-matches as single-item sets
  for (const { item1, item2 } of maybeMatches) {
    if (!normalizedMatches[item1]) normalizedMatches[item1] = new Set([item1]);
    if (!normalizedMatches[item2]) normalizedMatches[item2] = new Set([item2]);
  }

  for (const item of unaccounted) {
    assert.ok(!normalizedMatches[item]);
    normalizedMatches[item] = new Set([item]);
  }

  saveForInspection('matched-groups-all',
    Array.from(new Set(Object.values(normalizedMatches)))
      .map(group => Array.from(group)
        .map(id => shorterLicenseInfo(itemsByAddonLicenseId[id].license))
        .sort(sorter(l => l.start))));

  saveForInspection('matched-groups-to-check',
    Array.from(new Set(Object.values(normalizedMatches)))
      .map(group => Array.from(group)
        .map(id => shorterLicenseInfo(itemsByAddonLicenseId[id].license))
        .sort(sorter(l => l.start)))
      .filter(group => (
        group.length > 1 &&
        (
          !group.every(item => item.tech_email === group[0].tech_email) ||
          !group.every(item => item.company === group[0].company) ||
          !group.every(item => item.tech_address === group[0].tech_address)
        )
      )));

  log.info('Scoring Engine', 'Done');

  return (
    Array.from(new Set(Object.values(normalizedMatches)))
      .map(group => Array.from(group)
        .map(id => itemsByAddonLicenseId[id])
        .sort(sorter(m => m.license.maintenanceStartDate)))
  );
}

function buildMappingStructure(contacts: { [key: string]: Contact }, transactions: Transaction[], licenses: License[]) {
  const mapping: { [key: string]: { license: License, transactions: Transaction[], partnerLicense: boolean, partnerTransaction: boolean } } = {};

  const oddTransactions: Transaction[] = [];

  for (const license of licenses) {
    const id = license.addonLicenseId;
    assert.ok(!mapping[id], 'Expected license id to be unique.');

    const contact = contacts[license.contactDetails.technicalContact.email];
    assert.ok(contact, `No contact for: ${license.contactDetails.technicalContact.email}`);

    mapping[id] = {
      transactions: [],
      license,
      partnerLicense: contact.contact_type === 'Partner',
      partnerTransaction: false,
    };
  }

  for (const transaction of transactions) {
    const id = transaction.addonLicenseId;

    if (!mapping[id]) {
      oddTransactions.push(transaction);
      continue;
    }

    const contact = contacts[transaction.customerDetails.technicalContact.email];
    assert.ok(contact, 'No contact');

    if (contact.contact_type === 'Partner') {
      mapping[id].partnerTransaction = true;
    }

    mapping[id].transactions.push(transaction);
  }

  const oddBalances: { [addonLicenseId: string]: { balance: number, tx: Transaction } } = {};

  for (const tx of oddTransactions) {
    if (!oddBalances[tx.addonLicenseId]) oddBalances[tx.addonLicenseId] = { balance: 0, tx };
    oddBalances[tx.addonLicenseId].balance += tx.purchaseDetails.purchasePrice;
  }

  const badBalances = (Object.values(oddBalances)
    .filter(({ balance }) => (balance !== 0))
    .map(({ tx }) => [tx.transactionId, tx.addonLicenseId]));

  if (badBalances.length > 0) {
    log.warn('Scoring Engine', "The following transactions have no accompanying licenses:",
      badBalances.map(([transaction, license]) => ({ transaction, license })));
  }

  removeDuplicateTransactions(licenses, transactions);

  return Object.fromEntries(Object.entries(mapping)
    .filter(([, m]) => !m.partnerLicense && !m.partnerTransaction)
    .map(([id, { license, transactions }]) => [
      id,
      { license, transactions },
    ])
  );
}

function groupMappingByProduct(mapping: { [key: string]: LicenseContext }) {
  const productMapping: { [addonKeyAndHosting: string]: { addonKey: string, hosting: string, group: License[] } } = {};

  for (const [id, { license }] of Object.entries(mapping)) {
    const addonKey = license.addonKey;
    const hosting = license.hosting;
    const key = `${addonKey} - ${hosting}`;

    if (!productMapping[key]) productMapping[key] = { addonKey, hosting, group: [] };
    productMapping[key].group.push(license);
  }

  return Object.values(productMapping);
}

/** Score how likely each license is connected to another license. */
function scoreLicenseMatches(productGroupings: { addonKey: string; hosting: string; group: License[] }[], scorer: LicenseMatcher) {
  log.info('Scoring Engine', 'Preparing license-matching jobs within [addonKey + hosting] groups');

  const maybeMatches: { score: number, item1: string, item2: string, reasons: string[] }[] = [];

  const unaccounted: Set<string> = new Set();

  log.info('Scoring Engine', 'Running license-similarity scoring');
  const startTime = process.hrtime.bigint();

  for (const { addonKey, hosting, group } of productGroupings) {
    log.info('Scoring Engine', `  Scoring [${addonKey}, ${hosting}]`);

    for (let i1 = 0; i1 < group.length; i1++) {
      for (let i2 = i1 + 1; i2 < group.length; i2++) {
        const license1 = group[i1];
        const license2 = group[i2];

        const result = scorer.score(license1, license2);

        if (result) {
          if (result.score === -1000) {
            unaccounted.add(result.item1);
            unaccounted.add(result.item2);
          }
          else {
            maybeMatches.push(result);
          }
        }
        else {
          unaccounted.add(license1.addonLicenseId);
          unaccounted.add(license2.addonLicenseId);
        }
      }
    }
  }

  const endTime = process.hrtime.bigint();
  log.info('Scoring Engine', `Total time: ${timeAsMinutesSeconds(endTime - startTime)}`);

  for (const m of maybeMatches) {
    unaccounted.delete(m.item1);
    unaccounted.delete(m.item2);
  }

  return {
    maybeMatches,
    unaccounted,
  };
}

export function shorterLicenseInfo(license: License) {
  return {
    addonLicenseId: license.addonLicenseId,

    company: license.contactDetails.company,

    tech_email: license.contactDetails.technicalContact.email,
    tech_name: license.contactDetails.technicalContact.name,
    tech_address: license.contactDetails.technicalContact.address1,
    tech_city: license.contactDetails.technicalContact.city,
    tech_phone: license.contactDetails.technicalContact.phone,
    tech_state: license.contactDetails.technicalContact.state,
    tech_zip: license.contactDetails.technicalContact.postcode,
    tech_country: license.contactDetails.country,
    tech_address2: license.contactDetails.technicalContact.address2,

    start: license.maintenanceStartDate,
    end: license.maintenanceEndDate,

    billing_email: license.contactDetails.billingContact?.email,
    partner_email: license.partnerDetails?.billingContact.email,
  };
}

export function normalizeMatches(maybeMatches: { score: number, item1: string, item2: string }[], threshold: number) {
  const normalizedMatches: { [id: string]: Set<string> } = {};

  for (const { item1, item2, score } of maybeMatches) {
    if (score < threshold) continue;

    const set1 = normalizedMatches[item1];
    const set2 = normalizedMatches[item2];

    let list: Set<string>;

    if (set1 && set2) {
      if (set1 === set2) {
        list = set1;
      }
      else {
        list = new Set([...set1, ...set2]);

        for (const id of list) {
          normalizedMatches[id] = list;
        }
      }
    }
    else if (!set1 && !set2) {
      list = new Set();
      normalizedMatches[item1] = list;
      normalizedMatches[item2] = list;
    }
    else {
      if (set1) {
        list = set1;
        normalizedMatches[item2] = list;
      }
      else {
        list = set2;
        normalizedMatches[item1] = list;
      }
    }

    list.add(item1);
    list.add(item2);
  }

  const final: { [id: string]: Set<string> } = Object.create(null);

  for (const bag of new Set(Object.values(normalizedMatches))) {
    for (const id of bag) {
      // Verify
      assert.ok(!final[id], `License ID found in two lists: ${id}`);

      // Quick access
      final[id] = bag;
    }
  }

  return final;
}

function removeDuplicateTransactions(allLicenses: License[], allTransactions: Transaction[]) {
  const transactionsWithSameId = (
    Object.values(
      _.groupBy(allTransactions, t => [t.transactionId, t.addonKey, t.purchaseDetails.hosting, t.purchaseDetails.saleDate])
    )
      .filter(m => m.length > 1)
  );

  for (const ts of transactionsWithSameId) {
    for (let i1 = 0; i1 < ts.length; i1++) {
      for (let i2 = i1 + 1; i2 < ts.length; i2++) {
        const t1 = ts[i1];
        const t2 = ts[i2];

        const ls = allLicenses.filter(l => [t1.addonLicenseId, t2.addonLicenseId].includes(l.addonLicenseId));
        const [l1, l2] = ls;

        if (l1 && l2 && equalExceptIds(t1, t2) && equalExceptIds(l1, l2)) {
          allTransactions.splice(allTransactions.indexOf(t1), 1);
          allLicenses.splice(allLicenses.indexOf(l1), 1);
        }
      }
    }
  }
}

function equalExceptIds(a: License | Transaction, b: License | Transaction) {
  if (a.licenseId == b.licenseId) return false;
  if (a.addonLicenseId == b.addonLicenseId) return false;
  const { addonLicenseId: ga1, licenseId: ga2, ...a1 } = a;
  const { addonLicenseId: gb1, licenseId: gb2, ...b1 } = b;
  return util.isDeepStrictEqual(a1, b1);
}

function timeAsMinutesSeconds(ns: bigint) {
  const total = Number(ns / 1_000_000_000n);

  const m = Math.floor(total / 60);
  const s = total % 60;

  const mm = m.toFixed().padStart(2, '0');
  const ss = s.toFixed().padStart(2, '0');

  return `${mm}:${ss}`;
}
