import assert from "assert";
import util from "util";
import log from '../../log/logger';
import env from '../../parameters/env-config';
import { AttachableError } from '../../util/errors';
import { isPresent } from "../../util/helpers";
import { License, LicenseData } from "../license";
import { Transaction } from "../transaction";

export function validateMarketplaceData(
  licenses: readonly License[],
  transactions: readonly Transaction[],
  emailRe: RegExp,
) {
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

  return {
    transactions: transactions.filter(emailChecker('Transaction')),
    licenses: licenses.filter(emailChecker('License')),
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
