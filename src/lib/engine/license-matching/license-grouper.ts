import assert from 'assert';
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

  const scorer = new LicenseMatcher(db.providerDomains);
  const normalizedMatches = scoreLicenseMatches(threshold, productGroupings, scorer);

  saveForInspection('matched-groups-all',
    Array.from(normalizedMatches)
      .map(group => Array.from(group)
        .map(l => shorterLicenseInfo(l))
        .sort(sorter(l => l.start))));

  saveForInspection('matched-groups-to-check',
    Array.from(normalizedMatches)
      .map(group => Array.from(group)
        .map(l => shorterLicenseInfo(l))
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

  const matchGroups = Array.from(normalizedMatches)
    .map(group => Array.from(group)
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
function scoreLicenseMatches(
  threshold: number,
  productGroupings: Iterable<{
    addonKey: string;
    hosting: string;
    group: License[];
  }>,
  scorer: LicenseMatcher
) {
  log.info('Scoring Engine', 'Preparing license-matching jobs within [addonKey + hosting] groups');

  const groups = new Map<License, Set<License>>();

  const join = (license1: License, license2: License) => {
    const group1 = groups.get(license1)!;
    const group2 = groups.get(license2)!;
    const combinedGroup = new Set([...group1, ...group2]);
    for (const l of combinedGroup) {
      groups.set(l, combinedGroup);
    }
  };

  const init = (license: License) => {
    if (groups.has(license)) return;

    groups.set(license, new Set([license]));

    if (license.evaluatedTo) {
      init(license.evaluatedTo);
      join(license.evaluatedTo, license);
    }

    if (license.evaluatedFrom) {
      init(license.evaluatedFrom);
      join(license.evaluatedFrom, license);
    }
  };

  log.info('Scoring Engine', 'Running license-similarity scoring');
  const startTime = process.hrtime.bigint();

  for (const { addonKey, hosting, group } of productGroupings) {
    log.info('Scoring Engine', `  Scoring [${addonKey}, ${hosting}]`);

    for (let i1 = 0; i1 < group.length; i1++) {
      for (let i2 = i1 + 1; i2 < group.length; i2++) {
        const license1 = group[i1];
        const license2 = group[i2];

        init(license1);
        init(license2);

        if (scorer.isSimilarEnough(threshold, license1, license2)) {
          join(license1, license2);
        }
      }
    }
  }

  const endTime = process.hrtime.bigint();
  log.info('Scoring Engine', `Total time: ${timeAsMinutesSeconds(endTime - startTime)}`);

  return new Set(groups.values());
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

function timeAsMinutesSeconds(ns: bigint) {
  const total = Number(ns / 1_000_000_000n);

  const m = Math.floor(total / 60);
  const s = total % 60;

  const mm = m.toFixed().padStart(2, '0');
  const ss = s.toFixed().padStart(2, '0');

  return `${mm}:${ss}`;
}
