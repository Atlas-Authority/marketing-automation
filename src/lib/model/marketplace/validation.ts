import assert from "assert";
import util from "util";
import log from '../../log/logger';
import env from '../../parameters/env-config';
import { AttachableError } from '../../util/errors';
import { isPresent } from '../../util/helpers';
import { RawLicense, RawTransaction } from './raw';

export function validateMarketplaceData(
  licensesWithDataInsights: readonly RawLicense[],
  licensesWithoutDataInsights: readonly RawLicense[],
  transactions: readonly RawTransaction[],
  emailRe: RegExp,
) {
  const licenses = uniqLicenses([
    ...licensesWithDataInsights.filter(filterLicensesWithTechEmail),
    ...licensesWithoutDataInsights.filter(filterLicensesWithTechEmail),
  ]);

  licenses.forEach(validateLicense);
  transactions.forEach(validateTransaction);

  const emailChecker = (kind: 'License' | 'Transaction') =>
    (item: RawLicense | RawTransaction) => {
      const allEmails = getEmails(item);
      const allGood = allEmails.every(e => emailRe.test(e));
      if (!allGood && !allEmails.every(e => env.engine.ignoredEmails.has(e.toLowerCase()))) {
        log.warn('Downloader', `${kind} has invalid email(s); will be skipped:`, item);
      }
      return allGood;
    };

  return {
    transactions: transactions.filter(emailChecker('Transaction')),
    licenses: licenses.filter(emailChecker('License')),
  };
}

function uniqLicenses(licenses: RawLicense[]) {
  const groups: { [addonLicenseId: string]: RawLicense[] } = {};

  for (const license of licenses) {
    if (!groups[license.addonLicenseId]) {
      groups[license.addonLicenseId] = [license];
    }
    else if (!groups[license.addonLicenseId].some(other => util.isDeepStrictEqual(license, other))) {
      groups[license.addonLicenseId].push(license);
    }
  }

  // These are created at the very edge of the 2018-07-01 cutoff between with/without attributions
  const edgeCases = Object.values(groups).filter(ls => ls.length > 1);
  for (const dups of edgeCases) {
    assert.ok(dups
      .map(({
        attribution, evaluationOpportunitySize,
        parentProductBillingCycle, parentProductName,
        installedOnSandbox, parentProductEdition,
        evaluationLicense, evaluationSaleDate,
        evaluationStartDate, evaluationEndDate,
        daysToConvertEval,
        ...dup }) => dup)
      .every((dup, i, array) => util.isDeepStrictEqual(dup, array[0])),
      util.inspect(dups, { colors: true, depth: null })
    );

    // Keep the first one with attributions
    dups.sort((a, b) => a.evaluationOpportunitySize ? -1 : 1);
    assert.ok(dups[0].evaluationOpportunitySize);
    dups.length = 1;
  }

  const fixed = Object.values(groups);
  assert.ok(fixed.every(ls => ls.length === 1));

  return fixed.map(ls => ls[0]);
}

function validateLicense(license: RawLicense) {
  validateField(license, license => license.licenseId);
  validateField(license, license => license.addonKey);
  validateField(license, license => license.addonName);
  validateField(license, license => license.lastUpdated);
  validateField(license, license => license.contactDetails);
  validateField(license, license => license.contactDetails.technicalContact);
  validateField(license, license => license.contactDetails.technicalContact.email);
  validateField(license, license => license.tier);
  validateField(license, license => license.licenseType);
  validateField(license, license => license.hosting);
  validateField(license, license => license.maintenanceStartDate);
  validateField(license, license => license.maintenanceEndDate);
  validateField(license, license => license.status);
}

function validateTransaction(transaction: RawTransaction) {
  validateField(transaction, transaction => transaction.transactionId);
  validateField(transaction, transaction => transaction.addonLicenseId);
  validateField(transaction, transaction => transaction.licenseId);
  validateField(transaction, transaction => transaction.addonKey);
  validateField(transaction, transaction => transaction.addonName);
  validateField(transaction, transaction => transaction.lastUpdated);
  validateField(transaction, transaction => transaction.customerDetails);
  validateField(transaction, transaction => transaction.customerDetails.technicalContact);
  validateField(transaction, transaction => transaction.customerDetails.technicalContact.email);
  validateField(transaction, transaction => transaction.purchaseDetails);
  validateField(transaction, transaction => transaction.purchaseDetails.saleDate);
  validateField(transaction, transaction => transaction.purchaseDetails.tier);
  validateField(transaction, transaction => transaction.purchaseDetails.licenseType);
  validateField(transaction, transaction => transaction.purchaseDetails.hosting);
  validateField(transaction, transaction => transaction.purchaseDetails.billingPeriod);
  validateField(transaction, transaction => transaction.purchaseDetails.purchasePrice);
  validateField(transaction, transaction => transaction.purchaseDetails.vendorAmount);
  validateField(transaction, transaction => transaction.purchaseDetails.saleType);
  validateField(transaction, transaction => transaction.purchaseDetails.maintenanceStartDate);
  validateField(transaction, transaction => transaction.purchaseDetails.maintenanceEndDate);
}

function validateField<T>(o: T, accessor: (o: T) => any) {
  const val = accessor(o);
  const path = accessor.toString().replace(/^(\w+) => /, '');
  if (!val) throw new AttachableError(`Missing field: ${path}`, JSON.stringify(o, null, 2));
}

function filterLicensesWithTechEmail(license: RawLicense) {
  if (!license.contactDetails.technicalContact?.email) {
    log.warn('Downloader', 'License does not have a tech contact email; will be skipped', license.addonLicenseId);
    return false;
  }
  return true;
}

function isRawTransaction(item: RawTransaction | RawLicense): item is RawTransaction {
  return 'transactionId' in item;
}

function getEmails(item: RawTransaction | RawLicense) {
  if (!isRawTransaction(item)) {
    return [
      item.contactDetails.technicalContact.email,
      item.contactDetails.billingContact?.email,
      item.partnerDetails?.billingContact.email,
    ].filter(isPresent);
  }
  else {
    return [
      item.customerDetails.technicalContact.email,
      item.customerDetails.billingContact?.email,
      item.partnerDetails?.billingContact.email,
    ].filter(isPresent);
  }
}
