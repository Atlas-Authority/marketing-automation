import assert from 'assert';
import util from 'util';
import log from "../../log/logger.js";
import { AttachableError } from "../../util/errors.js";
import { isPresent } from '../../util/helpers.js';
import { RawLicense, RawTransaction } from "./raw.js";

export function validateMarketplaceData(
  licensesWithDataInsights: RawLicense[],
  licensesWithoutDataInsights: RawLicense[],
  allTransactions: RawTransaction[],
  emailRe: RegExp,
) {
  licensesWithDataInsights = licensesWithDataInsights.filter(filterLicensesWithTechEmail);
  licensesWithoutDataInsights = licensesWithoutDataInsights.filter(filterLicensesWithTechEmail);

  licensesWithDataInsights.forEach(fixOdditiesInLicenses);
  licensesWithoutDataInsights.forEach(fixOdditiesInLicenses);

  verifyStructure('licenses_with_data_insights',
    licensesWithDataInsights,
    licensesWithDataInsightsSchema);

  verifyStructure('licenses_without_data_insights',
    licensesWithoutDataInsights,
    licensesWithoutDataInsightsSchema);

  verifyStructure('transactions',
    allTransactions,
    transactionsSchema);

  let allLicenses = uniqLicenses(licensesWithDataInsights.concat(licensesWithoutDataInsights));

  const emailChecker = (kind: 'License' | 'Transaction') =>
    (item: RawLicense | RawTransaction) => {
      const allGood = getEmails(item).every(e => emailRe.test(e));
      if (!allGood) log.warn('Downloader', `${kind} has invalid email(s); will be skipped:`, item);
      return allGood;
    };

  return {
    transactions: allTransactions.filter(emailChecker('Transaction')),
    licenses: allLicenses.filter(emailChecker('License')),
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

function verifyStructure<T>(name: string, data: T[], schema: Array<['every' | 'some', (item: T) => boolean]>) {
  log.info('Downloader', 'Verifying schema for:', name);
  for (const [howMany, getter] of schema) {
    const test: (items: T[]) => boolean = (
      howMany === 'every'
        ? items => items.every(getter)
        : items => items.some(getter)
    );

    if (!test(data)) {
      let errorData = data;

      if (howMany === 'every') {
        errorData = data.filter(item => !getter(item));
      }

      throw new AttachableError(`Schema changed for ${name}: ${getter.toString()} -- no longer holds true for ${howMany} items`, JSON.stringify(errorData, null, 2));
    }
  }
}

const licensesWithDataInsightsSchema: Array<['every' | 'some', (license: RawLicense) => boolean]> = [
  ['every', license => isNonBlankString(license?.addonLicenseId)],
  ['every', license => isNonBlankString(license?.licenseId)],
  ['every', license => isNonBlankString(license?.addonKey)],
  ['every', license => isNonBlankString(license?.addonName)],
  ['every', license => isNonBlankString(license?.hosting)],
  ['every', license => isNonBlankString(license?.lastUpdated)],
  ['every', license => isNonBlankString(license?.licenseType)],
  ['every', license => isNonBlankString(license?.maintenanceStartDate)],
  ['every', license => isNonBlankString(license?.maintenanceEndDate)],
  ['every', license => isNonBlankString(license?.status)],
  ['every', license => isNonBlankString(license?.tier)],

  ['every', license => !!license?.contactDetails],
  ['every', license => isString(license?.contactDetails?.company)],
  ['every', license => isNonBlankString(license?.contactDetails?.country)],
  ['every', license => isNonBlankString(license?.contactDetails?.region)],

  ['every', license => !!license?.contactDetails?.technicalContact],
  ['every', license => isNonBlankString(license?.contactDetails?.technicalContact?.email)],
  ['some', license => isNonBlankString(license?.contactDetails?.technicalContact?.name)],
  ['some', license => isNonBlankString(license?.contactDetails?.technicalContact?.phone)],
  ['some', license => isNonBlankString(license?.contactDetails?.technicalContact?.city)],
  ['some', license => isNonBlankString(license?.contactDetails?.technicalContact?.state)],

  ['some', license => !!license?.contactDetails?.billingContact],
  ['every', license => !license?.contactDetails?.billingContact || isNonBlankString(license?.contactDetails?.billingContact.email)],
  ['some', license => !license?.contactDetails?.billingContact || isNonBlankString(license?.contactDetails?.billingContact.name)],
  ['some', license => !license?.contactDetails?.billingContact || isNonBlankString(license?.contactDetails?.billingContact.phone)],
  ['some', license => !license?.contactDetails?.billingContact || isNonBlankString(license?.contactDetails?.billingContact.city)],
  ['some', license => !license?.contactDetails?.billingContact || isNonBlankString(license?.contactDetails?.billingContact.state)],

  ['some', transaction => !!transaction?.partnerDetails],
  ['every', transaction => !transaction?.partnerDetails || isNonBlankString(transaction?.partnerDetails?.partnerName)],
  ['some', transaction => !transaction?.partnerDetails || isNonBlankString(transaction?.partnerDetails?.partnerType)],

  ['some', license => !!license?.partnerDetails?.billingContact],
  ['every', license => !license?.partnerDetails?.billingContact || isNonBlankString(license?.partnerDetails?.billingContact.email)],
  ['every', license => !license?.partnerDetails?.billingContact || isNonBlankString(license?.partnerDetails?.billingContact.name)],

  ['every', license => isNonBlankString(license?.evaluationOpportunitySize)],
  ['some', license => !!license?.attribution],
  ['every', license => !license?.attribution || isNonBlankString(license?.attribution?.channel)],
  ['some', license => !license?.attribution || isNonBlankString(license?.attribution?.referrerDomain)],
  ['some', license => !license?.attribution || isNonBlankString(license?.attribution?.campaignName)],
  ['some', license => !license?.attribution || isNonBlankString(license?.attribution?.campaignSource)],
  ['some', license => !license?.attribution || isNonBlankString(license?.attribution?.campaignMedium)],
  ['some', license => !license?.attribution || isNonBlankString(license?.attribution?.campaignContent)],

  ['every', license => isNonBlankString(license?.parentProductBillingCycle)],
  ['every', license => isNonBlankString(license?.parentProductName)],
  ['every', license => isNonBlankString(license?.installedOnSandbox)],
  ['every', license => isNonBlankString(license?.parentProductEdition)],

  ['some', license => isNonBlankString(license?.evaluationLicense)],
  ['some', license => isNonBlankString(license?.daysToConvertEval)],
  ['some', license => isNonBlankString(license?.evaluationStartDate)],
  ['some', license => isNonBlankString(license?.evaluationEndDate)],
  ['some', license => isNonBlankString(license?.evaluationSaleDate)],
  ['every', license =>
    (
      isUndefined(license?.evaluationLicense) &&
      isUndefined(license?.daysToConvertEval) &&
      isUndefined(license?.evaluationStartDate) &&
      isUndefined(license?.evaluationEndDate) &&
      isUndefined(license?.evaluationSaleDate)
    ) || (
      isNonBlankString(license?.evaluationLicense) &&
      isNonBlankString(license?.daysToConvertEval) &&
      isNonBlankString(license?.evaluationStartDate) &&
      isNonBlankString(license?.evaluationEndDate) &&
      isNonBlankString(license?.evaluationSaleDate)
    )
  ],
];

const licensesWithoutDataInsightsSchema: Array<['every' | 'some', (license: RawLicense) => boolean]> = [
  ['every', license => isNonBlankString(license?.addonLicenseId)],
  ['every', license => isNonBlankString(license?.licenseId)],
  ['every', license => isNonBlankString(license?.addonKey)],
  ['every', license => isNonBlankString(license?.addonName)],
  ['every', license => isNonBlankString(license?.hosting)],
  ['every', license => isNonBlankString(license?.lastUpdated)],
  ['every', license => isNonBlankString(license?.licenseType)],
  ['every', license => isNonBlankString(license?.maintenanceStartDate)],
  ['every', license => isNonBlankString(license?.maintenanceEndDate)],
  ['every', license => isNonBlankString(license?.status)],
  ['every', license => isNonBlankString(license?.tier)],

  ['every', license => !!license?.contactDetails],
  ['some', license => isNonBlankString(license?.contactDetails?.company)],
  ['every', license => isNonBlankString(license?.contactDetails?.country)],
  ['every', license => isNonBlankString(license?.contactDetails?.region)],

  ['every', license => !!license?.contactDetails?.technicalContact],
  ['every', license => isNonBlankString(license?.contactDetails?.technicalContact?.email)],
  ['some', license => isNonBlankString(license?.contactDetails?.technicalContact?.name)],
  ['some', license => isNonBlankString(license?.contactDetails?.technicalContact?.phone)],
  ['some', license => isNonBlankString(license?.contactDetails?.technicalContact?.city)],
  ['some', license => isNonBlankString(license?.contactDetails?.technicalContact?.state)],

  ['some', license => !!license?.contactDetails?.billingContact],
  ['every', license => !license?.contactDetails?.billingContact || isNonBlankString(license?.contactDetails?.billingContact.email)],
  ['some', license => !license?.contactDetails?.billingContact || isNonBlankString(license?.contactDetails?.billingContact.name)],
  ['some', license => !license?.contactDetails?.billingContact || isNonBlankString(license?.contactDetails?.billingContact.phone)],
  ['some', license => !license?.contactDetails?.billingContact || isNonBlankString(license?.contactDetails?.billingContact.city)],
  ['some', license => !license?.contactDetails?.billingContact || isNonBlankString(license?.contactDetails?.billingContact.state)],

  ['some', transaction => !!transaction?.partnerDetails],
  ['every', transaction => !transaction?.partnerDetails || isNonBlankString(transaction?.partnerDetails?.partnerName)],
  ['some', transaction => !transaction?.partnerDetails || isNonBlankString(transaction?.partnerDetails?.partnerType)],

  ['some', license => !!license?.partnerDetails?.billingContact],
  ['every', license => !license?.partnerDetails?.billingContact || isNonBlankString(license?.partnerDetails?.billingContact.email)],
  ['every', license => !license?.partnerDetails?.billingContact || isNonBlankString(license?.partnerDetails?.billingContact.name)],

  ['every', license => isUndefined(license?.evaluationOpportunitySize)],
  ['every', license => !license?.attribution],

  ['every', license => isUndefined(license?.parentProductBillingCycle)],
  ['every', license => isUndefined(license?.parentProductName)],
  ['every', license => isUndefined(license?.installedOnSandbox)],
  ['every', license => isUndefined(license?.parentProductEdition)],

  ['every', license => isUndefined(license?.evaluationLicense)],
  ['every', license => isUndefined(license?.daysToConvertEval)],
  ['every', license => isUndefined(license?.evaluationStartDate)],
  ['every', license => isUndefined(license?.evaluationEndDate)],
  ['every', license => isUndefined(license?.evaluationSaleDate)],
];

const transactionsSchema: Array<['every' | 'some', (transaction: RawTransaction) => boolean]> = [
  ['every', transaction => isNonBlankString(transaction?.transactionId)],
  ['every', transaction => isNonBlankString(transaction?.addonLicenseId)],
  ['every', transaction => isNonBlankString(transaction?.licenseId)],
  ['every', transaction => isNonBlankString(transaction?.addonKey)],
  ['every', transaction => isNonBlankString(transaction?.addonName)],

  ['every', transaction => !!transaction?.customerDetails],
  ['every', transaction => isNonBlankString(transaction?.customerDetails?.company)],
  ['every', transaction => isNonBlankString(transaction?.customerDetails?.country)],
  ['every', transaction => isNonBlankString(transaction?.customerDetails?.region)],

  ['every', transaction => !!transaction?.customerDetails.technicalContact],
  ['every', transaction => isNonBlankString(transaction?.customerDetails?.technicalContact?.email)],
  ['some', transaction => isNonBlankString(transaction?.customerDetails?.technicalContact?.name)],

  ['every', transaction => !!transaction?.customerDetails.billingContact],
  ['every', transaction => isNonBlankString(transaction?.customerDetails?.billingContact?.email)],
  ['some', transaction => isNonBlankString(transaction?.customerDetails?.billingContact?.name)],

  ['every', transaction => isNonBlankString(transaction?.purchaseDetails?.saleDate)],
  ['every', transaction => isNonBlankString(transaction?.purchaseDetails?.tier)],
  ['every', transaction => isNonBlankString(transaction?.purchaseDetails?.licenseType)],
  ['every', transaction => isNonBlankString(transaction?.purchaseDetails?.hosting)],
  ['every', transaction => isNonBlankString(transaction?.purchaseDetails?.billingPeriod)],
  ['every', transaction => isNumber(transaction?.purchaseDetails?.purchasePrice)],
  ['every', transaction => isNumber(transaction?.purchaseDetails?.vendorAmount)],
  ['every', transaction => isNonBlankString(transaction?.purchaseDetails?.saleType)],
  ['every', transaction => isNonBlankString(transaction?.purchaseDetails?.maintenanceStartDate)],
  ['every', transaction => isNonBlankString(transaction?.purchaseDetails?.maintenanceEndDate)],

  ['some', transaction => !!transaction?.partnerDetails],
  ['every', transaction => !transaction?.partnerDetails || isNonBlankString(transaction?.partnerDetails?.partnerName)],
  ['some', transaction => !transaction?.partnerDetails || isNonBlankString(transaction?.partnerDetails?.partnerType)],

  ['every', transaction => !transaction?.partnerDetails || !!transaction?.partnerDetails?.billingContact],
  ['every', transaction => !transaction?.partnerDetails || isNonBlankString(transaction?.partnerDetails?.billingContact?.email)],
  ['every', transaction => !transaction?.partnerDetails || isNonBlankString(transaction?.partnerDetails?.billingContact?.name)],
];

function isNonBlankString(s: string | undefined) {
  return typeof s === 'string' && s.trim().length > 0;
}

function isString(s: string | undefined) {
  return typeof s === 'string';
}

function isNumber(s: number | undefined) {
  return typeof s === 'number';
}

function isUndefined(s: any) {
  return typeof s === 'undefined';
}

function filterLicensesWithTechEmail(license: RawLicense) {
  if (!license.contactDetails.technicalContact?.email) {
    log.warn('Downloader', 'License does not have a tech contact email; will be skipped', license.addonLicenseId);
    return false;
  }
  return true;
}

function fixOdditiesInLicenses(license: RawLicense) {
  normalizeLicenseNewlines(license.contactDetails.technicalContact, 'address1');
  normalizeLicenseNewlines(license.contactDetails.technicalContact, 'address2');
  normalizeLicenseNewlines(license.contactDetails.billingContact, 'address1');
  normalizeLicenseNewlines(license.contactDetails.billingContact, 'address2');

  normalizeLicenseNullLiteral(license.contactDetails.technicalContact, 'phone');
  normalizeLicenseNullLiteral(license.contactDetails.technicalContact, 'address1');
  normalizeLicenseNullLiteral(license.contactDetails.technicalContact, 'city');
  normalizeLicenseNullLiteral(license.contactDetails.technicalContact, 'state');

  normalizeLicenseNullLiteral(license.contactDetails.billingContact, 'phone');
  normalizeLicenseNullLiteral(license.contactDetails.billingContact, 'address1');
  normalizeLicenseNullLiteral(license.contactDetails.billingContact, 'city');
  normalizeLicenseNullLiteral(license.contactDetails.billingContact, 'state');
}

function normalizeLicenseNewlines<T extends { [key: string]: string }, K extends keyof T>(o: T | undefined, key: K) {
  if (o && typeof (o[key]) === 'string') {
    o[key] = o[key].replace(/\r/g, '') as T[K];
  }
}

function normalizeLicenseNullLiteral<T extends { [key: string]: string }, K extends keyof T>(o: T | undefined, key: K) {
  if (o && (o[key]) === 'null') {
    delete o[key];
  }
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
