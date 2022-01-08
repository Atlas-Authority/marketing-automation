import assert from 'assert';
import { fnOrCache } from '../../cache/fn-cache';
import { saveForInspection } from '../../cache/inspection';
import log from '../../log/logger';
import { Table } from '../../log/table';
import { Database } from '../../model/database';
import { License } from '../../model/license';
import { AddonLicenseId } from '../../model/marketplace/common';
import { Transaction } from '../../model/transaction';
import { sorter } from '../../util/helpers';
import { LicenseMatcher } from './license-matcher';

/** Related via the matching engine. */
export type RelatedLicenseSet = License[];


export function matchIntoLikelyGroups(db: Database): RelatedLicenseSet[] {
  log.info('Scoring Engine', 'Storing licenses/transactions by id');
  const itemsByAddonLicenseId: Map<AddonLicenseId, License> = buildMappingStructure(db);

  log.info('Scoring Engine', 'Grouping licenses/transactions by hosting and addonKey');
  const productGroupings: Iterable<{ addonKey: string; hosting: string; group: License[] }> = groupMappingByProduct(itemsByAddonLicenseId);

  const threshold = 130;

  const { maybeMatches, unaccounted: unaccountedArray } = fnOrCache('scorer.json', () => {
    const scorer = new LicenseMatcher(db.providerDomains);
    const { maybeMatches, unaccounted } = scoreLicenseMatches(threshold, productGroupings, scorer);
    return {
      maybeMatches,
      unaccounted: [...unaccounted],
    };
  });
  const unaccounted = new Set(unaccountedArray);

  for (const license of db.licenses) {
    if (license.data.newEvalData) {
      const license1 = license.id;
      const license2 = license.data.newEvalData.evaluationLicense;
      maybeMatches.push({
        item1: license1,
        item2: license2,
      });
      unaccounted.delete(license1);
      unaccounted.delete(license2);
    }
  }

  log.info('Scoring Engine', 'Normalize license matches into groups over threshold');
  const normalizedMatches: { [addonLicenseId: string]: Set<string> } = normalizeMatches(maybeMatches);

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
        .map(id => shorterLicenseInfo(itemsByAddonLicenseId.get(id)!))
        .sort(sorter(l => l.start))));

  saveForInspection('matched-groups-to-check',
    Array.from(new Set(Object.values(normalizedMatches)))
      .map(group => Array.from(group)
        .map(id => shorterLicenseInfo(itemsByAddonLicenseId.get(id)!))
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

  const matchGroups = Array.from(new Set(Object.values(normalizedMatches)))
    .map(group => Array.from(group)
      .map(id => itemsByAddonLicenseId.get(id)!)
      .sort(sorter(license => license.data.maintenanceStartDate)));

  return matchGroups;
}

function buildMappingStructure(db: Database) {
  const mapping = new Map<AddonLicenseId, License>();

  const oddTransactions: Transaction[] = [];

  for (const license of db.licenses) {
    const id = license.data.addonLicenseId;
    assert.ok(!mapping.get(id), 'Expected license id to be unique.');

    mapping.set(id, license);
  }

  for (const transaction of db.transactions) {
    const id = transaction.data.addonLicenseId;

    const license = mapping.get(id);
    if (!license) {
      oddTransactions.push(transaction);
    }
    else {
      transaction.license = license;
      license.transactions.push(transaction);
    }
  }

  const oddBalances: {
    [addonLicenseId: string]: {
      balance: number,
      tx: Transaction,
    }
  } = Object.create(null);

  for (const tx of oddTransactions) {
    const id = tx.data.addonLicenseId;
    if (!oddBalances[id]) oddBalances[id] = { balance: 0, tx };
    oddBalances[id].balance += tx.data.purchasePrice;
  }

  const badBalances = (Object.values(oddBalances)
    .filter(({ balance }) => (balance !== 0)));

  if (badBalances.length > 0) {
    log.warn('Scoring Engine', "The following transactions have no accompanying licenses:");
    const table = new Table([{ title: 'Transaction' }, { title: 'License', align: 'right' }]);
    for (const { tx } of badBalances) { table.rows.push([tx.data.transactionId, tx.data.addonLicenseId]); }
    for (const row of table.eachRow()) {
      log.warn('Scoring Engine', '  ' + row);
    }
  }

  db.tallier.less('Ignored: Transactions without licenses', badBalances
    .map(({ tx }) => tx.data.vendorAmount)
    .reduce((a, b) => a + b, 0));

  return mapping;
}

function groupMappingByProduct(mapping: Map<AddonLicenseId, License>) {
  const productMapping = new Map<string, {
    addonKey: string,
    hosting: string,
    group: License[],
  }>();

  for (const license of mapping.values()) {
    const addonKey = license.data.addonKey;
    const hosting = license.data.hosting;
    const key = `${addonKey} - ${hosting}`;

    let list = productMapping.get(key);
    if (!list) productMapping.set(key, list = { addonKey, hosting, group: [] });
    list.group.push(license);
  }

  return productMapping.values();
}

/** Score how likely each license is connected to another license. */
function scoreLicenseMatches(threshold: number, productGroupings: Iterable<{ addonKey: string; hosting: string; group: License[] }>, scorer: LicenseMatcher) {
  log.info('Scoring Engine', 'Preparing license-matching jobs within [addonKey + hosting] groups');

  const maybeMatches: { item1: string, item2: string }[] = [];

  const unaccounted: Set<string> = new Set();

  log.info('Scoring Engine', 'Running license-similarity scoring');
  const startTime = process.hrtime.bigint();

  for (const { addonKey, hosting, group } of productGroupings) {
    log.info('Scoring Engine', `  Scoring [${addonKey}, ${hosting}]`);

    for (let i1 = 0; i1 < group.length; i1++) {
      for (let i2 = i1 + 1; i2 < group.length; i2++) {
        const license1 = group[i1];
        const license2 = group[i2];

        const matched = scorer.isSimilarEnough(threshold, license1, license2);

        if (matched) {
          const item1 = license1.data.addonLicenseId;
          const item2 = license2.data.addonLicenseId;
          maybeMatches.push({ item1, item2 });
        }
        else {
          unaccounted.add(license1.data.addonLicenseId);
          unaccounted.add(license2.data.addonLicenseId);
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
    addonLicenseId: license.data.addonLicenseId,

    company: license.data.company,

    tech_email: license.data.technicalContact.email,
    tech_name: license.data.technicalContact.name,
    tech_address: license.data.technicalContact.address1,
    tech_city: license.data.technicalContact.city,
    tech_phone: license.data.technicalContact.phone,
    tech_state: license.data.technicalContact.state,
    tech_zip: license.data.technicalContact.postcode,
    tech_country: license.data.country,
    tech_address2: license.data.technicalContact.address2,

    start: license.data.maintenanceStartDate,
    end: license.data.maintenanceEndDate,

    billing_email: license.data.billingContact?.email,
    partner_email: license.data.partnerDetails?.billingContact.email,
  };
}

export function normalizeMatches(maybeMatches: { item1: string, item2: string }[]) {
  const normalizedMatches: { [id: string]: Set<string> } = {};

  for (const { item1, item2 } of maybeMatches) {
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

function timeAsMinutesSeconds(ns: bigint) {
  const total = Number(ns / 1_000_000_000n);

  const m = Math.floor(total / 60);
  const s = total % 60;

  const mm = m.toFixed().padStart(2, '0');
  const ss = s.toFixed().padStart(2, '0');

  return `${mm}:${ss}`;
}
