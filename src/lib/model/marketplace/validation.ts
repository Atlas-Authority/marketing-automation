import assert from "assert";
import util from "util";
import log from '../../log/logger';
import { Table } from "../../log/table";
import env from '../../parameters/env-config';
import { AttachableError } from '../../util/errors';
import { formatMoney } from "../../util/formatters";
import { isPresent } from "../../util/helpers";
import { License, LicenseData } from "../license";
import { Transaction, TransactionData } from "../transaction";

export function validateMarketplaceData({ licenses, transactions, emailRe }: {
  licenses: readonly License[],
  transactions: readonly Transaction[],
  emailRe: RegExp,
}) {
  licenses = uniqLicenses(licenses.filter(hasTechEmail));

  licenses.forEach(validateLicense);
  transactions.forEach(validateTransaction);

  const emailChecker = (kind: 'License' | 'Transaction') =>
    (record: License | Transaction) => {
      const allEmails = getEmails(record);
      const allGood = allEmails.every(e => emailRe.test(e));
      if (!allGood && !allEmails.every(e => env.engine.ignoredEmails.has(e.toLowerCase()))) {
        log.warn('Downloader', `${kind} has invalid email(s); will be skipped:`, record);
      }
      return allGood;
    };

  return buildAndVerifyStructures(
    licenses.filter(emailChecker('License')),
    transactions.filter(emailChecker('Transaction')),
  );
}

function buildAndVerifyStructures(licenses: License[], transactions: Transaction[]) {
  // All three should be unique on licenses
  verifyIdIsUnique(licenses, l => l.data.addonLicenseId);
  verifyIdIsUnique(licenses, l => l.data.appEntitlementId);
  verifyIdIsUnique(licenses, l => l.data.appEntitlementNumber);

  const licensesByAddonLicenseId = new Map<string, License>();

  // Map all licenses first
  for (const license of licenses) {

    // All license IDs (when present) should point to the same transactions as each other
    const id1 = license.data.appEntitlementId;
    const id2 = license.data.appEntitlementNumber;
    const id3 = license.data.addonLicenseId;

    const array1 = !id1 ? null : transactions.filter(t => id1 === t.data.appEntitlementId);
    const array2 = !id2 ? null : transactions.filter(t => id2 === t.data.appEntitlementNumber);
    const array3 = !id3 ? null : transactions.filter(t => id3 === t.data.addonLicenseId);

    const set1 = array1 && uniqueTransactionSetFrom(array1);
    const set2 = array2 && uniqueTransactionSetFrom(array2);
    const set3 = array3 && uniqueTransactionSetFrom(array3);

    verifySameTransactionSet(set1 || null, set2 || null);
    verifySameTransactionSet(set2 || null, set3 || null);

    // Store transactions on license, and vice versa
    license.transactions = (array1 ?? array2 ?? array3)!;
    for (const t of license.transactions) {
      t.license = license;
    }

    // Map licenses by their 3 IDs
    if (license.data.addonLicenseId) {
      if (license.data.addonLicenseId) licensesByAddonLicenseId.set(license.data.addonLicenseId, license);
    }
  }

  // Connect via license's `evaluationLicense` if present
  for (const license of licenses) {
    if (license.data.newEvalData) {
      const evalLicense = licensesByAddonLicenseId.get(license.data.newEvalData.evaluationLicense);
      license.evaluatedFrom = evalLicense;
      evalLicense!.evaluatedTo = license;
    }
  }

  // Connect Licenses and Transactions
  const maybeRefunded = new Set<Transaction>();
  const refunds = new Set<Transaction>();

  for (const transaction of transactions) {

    // All license IDs on each transaction should point to the same license
    // (I'm 99% certain this is the logical inverse of the above,
    //  but adding this quick assertion just in case I'm wrong.
    //  Like, what if an ID is missing on License but not Transaction?
    //  It's a bit confusing right now, and this test is cheap.)
    const id1 = transaction.data.appEntitlementId;
    const id2 = transaction.data.appEntitlementNumber;
    const id3 = transaction.data.addonLicenseId;

    const license1 = id1 && licenses.find(l => id1 === l.data.appEntitlementId);
    const license2 = id2 && licenses.find(l => id2 === l.data.appEntitlementNumber);
    const license3 = id3 && licenses.find(l => id3 === l.data.addonLicenseId);

    verifyEqualLicenses(license1 || null, license2 || null);
    verifyEqualLicenses(license2 || null, license3 || null);

    // Check for transactions with missing licenses
    if (!transaction.license) {
      if (transaction.data.saleType === 'Refund') {
        refunds.add(transaction);
      }
      else {
        maybeRefunded.add(transaction);
      }
    }
  }

  // Warn when some transactions without matching licenses don't seem to be refunds
  const refundAmount = [...refunds].map(t => t.data.vendorAmount).reduce((a, b) => a + b, 0);
  const refundedAmount = [...maybeRefunded].map(t => t.data.vendorAmount).reduce((a, b) => a + b, 0);

  if (-refundAmount !== refundedAmount) {
    log.warn('Scoring Engine', "The following transactions have no accompanying licenses:");

    const sameById = (tx1: Transaction, tx2: Transaction, id: keyof TransactionData) => (
      tx1.data[id] && tx1.data[id] === tx2.data[id]
    );

    for (const refund of refunds) {
      const maybeMatch = [...maybeRefunded].find(maybeRefunded =>
        (
          sameById(refund, maybeRefunded, 'addonLicenseId') ||
          sameById(refund, maybeRefunded, 'appEntitlementId') ||
          sameById(refund, maybeRefunded, 'appEntitlementNumber')
        ) && maybeRefunded.data.vendorAmount === -refund.data.vendorAmount
      );
      if (maybeMatch) {
        refunds.delete(refund);
        maybeRefunded.delete(maybeMatch);
      }
    }

    if (refunds.size > 0) {
      Table.print({
        title: 'Refunds',
        log: s => log.warn('Scoring Engine', '  ' + s),
        cols: [
          [{ title: 'Transaction[License]', align: 'right' }, tx => tx.id],
          [{ title: 'Amount', align: 'right' }, tx => formatMoney(tx.data.vendorAmount)],
        ],
        rows: refunds,
      });
    }

    if (maybeRefunded.size > 0) {
      Table.print({
        title: 'Non-Refunds',
        log: s => log.warn('Scoring Engine', '  ' + s),
        cols: [
          [{ title: 'Transaction[License]', align: 'right' }, tx => tx.id],
          [{ title: 'Amount', align: 'right' }, tx => formatMoney(tx.data.vendorAmount)],
        ],
        rows: maybeRefunded,
      });
    }
  }

  return {
    licenses,
    transactions: transactions.filter(t => t.license),
  };
}

function uniqLicenses(licenses: readonly License[]) {
  const groups: { [addonLicenseId: string]: License[] } = {};

  for (const license of licenses) {
    if (!groups[license.id]) {
      groups[license.id] = [license];
    }
    else if (!groups[license.id].some(other => util.isDeepStrictEqual(license, other))) {
      groups[license.id].push(license);
    }
  }

  // These are created at the very edge of the 2018-07-01 cutoff between with/without attributions
  const edgeCases = Object.values(groups).filter(ls => ls.length > 1);
  for (const dups of edgeCases) {
    assert.ok(dups
      .map(dup => ({
        addonKey: dup.data.addonKey,
        addonName: dup.data.addonName,
        company: dup.data.company,
        country: dup.data.country,
        region: dup.data.region,
        technicalContact: dup.data.technicalContact,
        hosting: dup.data.hosting,
        lastUpdated: dup.data.lastUpdated,
        licenseId: dup.data.licenseId,
        licenseType: dup.data.licenseType,
        maintenanceEndDate: dup.data.maintenanceEndDate,
        maintenanceStartDate: dup.data.maintenanceStartDate,
        status: dup.data.status,
        tier: dup.data.tier,
        addonLicenseId: dup.data.addonLicenseId,
        appEntitlementId: dup.data.appEntitlementId,
        appEntitlementNumber: dup.data.appEntitlementNumber,
        partnerDetails: dup.data.partnerDetails,
      }) as Partial<LicenseData>)
      .every((dup, i, array) => util.isDeepStrictEqual(dup, array[0])),
      util.inspect(dups, { colors: true, depth: null })
    );

    // Keep the first one with attributions
    dups.sort((a, b) => a.data.evaluationOpportunitySize ? -1 : 1);
    assert.ok(dups[0].data.evaluationOpportunitySize);
    dups.length = 1;
  }

  const fixed = Object.values(groups);
  assert.ok(fixed.every(ls => ls.length === 1));

  return fixed.map(ls => ls[0]);
}

function validateLicense(license: License) {
  validateField(license, license => license.data.licenseId);
  validateField(license, license => license.data.addonKey);
  validateField(license, license => license.data.addonName);
  validateField(license, license => license.data.lastUpdated);
  // validateField(license, license => license.data.company);
  validateField(license, license => license.data.country);
  validateField(license, license => license.data.region);
  validateField(license, license => license.data.technicalContact);
  validateField(license, license => license.data.technicalContact.email);
  validateField(license, license => license.data.tier);
  validateField(license, license => license.data.licenseType);
  validateField(license, license => license.data.hosting);
  validateField(license, license => license.data.maintenanceStartDate);
  validateField(license, license => license.data.maintenanceEndDate);
  validateField(license, license => license.data.status);
}

function validateTransaction(transaction: Transaction) {
  validateField(transaction, transaction => transaction.data.transactionId);
  validateField(transaction, transaction => transaction.data.licenseId);
  validateField(transaction, transaction => transaction.data.addonKey);
  validateField(transaction, transaction => transaction.data.addonName);
  validateField(transaction, transaction => transaction.data.lastUpdated);
  validateField(transaction, transaction => transaction.data.company);
  validateField(transaction, transaction => transaction.data.country);
  validateField(transaction, transaction => transaction.data.region);
  validateField(transaction, transaction => transaction.data.technicalContact);
  validateField(transaction, transaction => transaction.data.technicalContact.email);
  validateField(transaction, transaction => transaction.data.saleDate);
  validateField(transaction, transaction => transaction.data.tier);
  validateField(transaction, transaction => transaction.data.licenseType);
  validateField(transaction, transaction => transaction.data.hosting);
  validateField(transaction, transaction => transaction.data.billingPeriod);
  validateField(transaction, transaction => transaction.data.purchasePrice);
  validateField(transaction, transaction => transaction.data.vendorAmount);
  validateField(transaction, transaction => transaction.data.saleType);
  validateField(transaction, transaction => transaction.data.maintenanceStartDate);
  validateField(transaction, transaction => transaction.data.maintenanceEndDate);
}

function validateField<T>(o: T, accessor: (o: T) => any) {
  const val = accessor(o);
  const path = accessor.toString().replace(/^(\w+) => /, '');
  if (!val) throw new AttachableError(`Missing field: ${path} (found ${JSON.stringify(val)})`, JSON.stringify(o, null, 2));
}

function hasTechEmail(license: License) {
  if (!license.data.technicalContact?.email) {
    const id = license.id;
    log.warn('Downloader', 'License does not have a tech contact email; will be skipped', id);
    return false;
  }
  return true;
}

function getEmails(record: License | Transaction) {
  return [
    record.data.technicalContact.email,
    record.data.billingContact?.email,
    record.data.partnerDetails?.billingContact.email,
  ].filter(isPresent);
}

export function verifyIdIsUnique(licenses: License[], getter: (r: License) => string | null) {
  const ids = licenses.map(getter).filter(isPresent);
  const idSet = new Set(ids);
  if (ids.length !== idSet.size) {
    const idName = getter.toString().replace(/(\w+) => \1\.data\./, '');
    log.error('Database', 'License IDs not unique:', idName);
  }
}

export function uniqueTransactionSetFrom(transactions: Transaction[]) {
  const set = new Set(transactions);
  if (set.size !== transactions.length) {
    log.error('Database', `Transactions aren't unique: got ${set.size} out of ${transactions.length}`);
  }
  return set;
}

export function verifySameTransactionSet(set1: Set<Transaction> | null, set2: Set<Transaction> | null) {
  if (!set1 || !set2) return;

  const same = set1.size === set2.size && [...set1].every(t => set2.has(t));
  if (!same) {
    log.error('Database', `License IDs do not point to same transactions`);
  }
}

export function verifyEqualLicenses(license1: License | null, license2: License | null) {
  if (!license1 || !license2) return;

  if (license1 !== license2) {
    log.error('Database', `License IDs do not point to same License from Transaction`);
  }
}
