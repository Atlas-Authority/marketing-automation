import assert from 'assert';
import util from 'util';
import log from "../../log/logger.js";
import { AttachableError } from "../../util/errors.js";
import { isPresent } from '../../util/helpers.js';
import { RawLicense, RawTransaction } from "./raw.js";

export function validateMarketplaceData(
  licensesWithDataInsights: RawLicense[],
  licensesWithoutDataInsights: RawLicense[],
  transactions: RawTransaction[],
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
      const allGood = getEmails(item).every(e => emailRe.test(e));
      if (!allGood) log.warn('Downloader', `${kind} has invalid email(s); will be skipped:`, item);
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
  validateField(license, l => l.addonLicenseId);
  validateField(license, l => l.licenseId);
  validateField(license, l => l.addonKey);
  validateField(license, l => l.addonName);
  validateField(license, l => l.lastUpdated);
  validateField(license, l => l.contactDetails);
  validateField(license, l => l.contactDetails.technicalContact);
  validateField(license, l => l.contactDetails.technicalContact.email);
  validateField(license, l => l.tier);
  validateField(license, l => l.licenseType);
  validateField(license, l => l.hosting);
  validateField(license, l => l.maintenanceStartDate);
  validateField(license, l => l.maintenanceEndDate);
  validateField(license, l => l.status);
}

function validateTransaction(transaction: RawTransaction) {
  validateField(transaction, t => t.transactionId);
  validateField(transaction, t => t.addonLicenseId);
  validateField(transaction, t => t.licenseId);
  validateField(transaction, t => t.addonKey);
  validateField(transaction, t => t.addonName);
  validateField(transaction, t => t.lastUpdated);
  validateField(transaction, t => t.customerDetails);
  validateField(transaction, t => t.customerDetails.technicalContact);
  validateField(transaction, t => t.customerDetails.technicalContact.email);
  validateField(transaction, t => t.purchaseDetails);
  validateField(transaction, t => t.purchaseDetails.saleDate);
  validateField(transaction, t => t.purchaseDetails.tier);
  validateField(transaction, t => t.purchaseDetails.licenseType);
  validateField(transaction, t => t.purchaseDetails.hosting);
  validateField(transaction, t => t.purchaseDetails.billingPeriod);
  validateField(transaction, t => t.purchaseDetails.purchasePrice);
  validateField(transaction, t => t.purchaseDetails.vendorAmount);
  validateField(transaction, t => t.purchaseDetails.saleType);
  validateField(transaction, t => t.purchaseDetails.maintenanceStartDate);
  validateField(transaction, t => t.purchaseDetails.maintenanceEndDate);
}

function validateField<T>(o: T, accessor: (o: T) => any) {
  const val = accessor(o);
  const path = accessor.toString().replace(/^(\w+) => \1\./, '');
  if (!val) throw new AttachableError(`Invalid License: ${path} missing`, JSON.stringify(o));
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
