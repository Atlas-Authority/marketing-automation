import assert from 'assert';
import util from 'util';
import { makeMultiProviderDomainsSet } from '../util/domains.js';
import { AttachableError } from '../util/errors.js';
import { isPresent } from '../util/helpers.js';
import logger from '../util/logger.js';

/**
 * @typedef InitialData
 * @property {Set<string>}   providerDomains
 * @property {License[]}     allLicenses
 * @property {Transaction[]} allTransactions
 * @property {Contact[]}     allContacts
 * @property {Deal[]}        allDeals
 * @property {Company[]}     allCompanies
 */

/**
 * @param {object} options
 * @param {Downloader} options.downloader
 * @return {Promise<InitialData>}
 */
export async function downloadAllData({ downloader }) {
  logger.info('Downloader', 'Starting downloads with API');

  let [
    freeDomains,
    licensesWithDataInsights,
    licensesWithoutDataInsights,
    allTransactions,
    allContacts,
    allDeals,
    allCompanies,
    allTlds,
  ] = await Promise.all([
    downloader.downloadFreeEmailProviders(),
    downloader.downloadLicensesWithDataInsights(),
    downloader.downloadLicensesWithoutDataInsights(),
    downloader.downloadTransactions(),
    downloader.downloadAllContacts(),
    downloader.downloadAllDeals(),
    downloader.downloadAllCompanies(),
    downloader.downloadAllTlds(),
  ]);

  verifyStructure('licenses_with_data_insights',
    licensesWithDataInsights,
    licensesWithDataInsightsSchema);

  verifyStructure('licenses_without_data_insights',
    licensesWithoutDataInsights,
    licensesWithoutDataInsightsSchema);

  verifyStructure('transactions',
    allTransactions,
    transactionsSchema);

  logger.info('Downloader', 'Done');

  let allLicenses = uniqLicenses(licensesWithDataInsights.concat(licensesWithoutDataInsights));

  const providerDomains = makeMultiProviderDomainsSet(freeDomains);

  const emailRe = makeEmailValidationRegex(allTlds);
  const hasValidEmails = makeEmailValidator(emailRe);
  allTransactions = allTransactions.filter(hasValidEmails);
  allLicenses = allLicenses.filter(hasValidEmails);

  return {
    providerDomains,
    allLicenses,
    allTransactions,
    allContacts,
    allDeals,
    allCompanies,
  };
}

/**
 * @param {License[]} licenses
 */
function uniqLicenses(licenses) {
  /** @type {{ [addonLicenseId: string]: License[] }} */
  const groups = {};

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
      .map(({ attribution, evaluationOpportunitySize, ...dup }) => dup)
      .every((dup, i, array) => util.isDeepStrictEqual(dup, array[0]))
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

/**
 * @template T
 * @param {string} name
 * @param {T[]} data
 * @param {Array<['every' | 'some', (license: T) => boolean]>} schema
 */
function verifyStructure(name, data, schema) {
  logger.info('Downloader', 'Verifying schema for:', name);
  for (const [howMany, getter] of schema) {
    if (!data[howMany](getter)) {
      let errorData = data;

      if (howMany === 'every') {
        errorData = data.filter(item => !getter(item));
      }

      throw new AttachableError(`Schema changed for ${name}: ${getter.toString()} -- no longer holds true for ${howMany} items`, JSON.stringify(errorData, null, 2));
    }
  }
}

/** @type {Array<['every' | 'some', (license: License) => boolean]>} */
const licensesWithDataInsightsSchema = [
  ['every', license => isString(license?.contactDetails?.technicalContact?.email)],
  ['some', license => isString(license?.contactDetails?.technicalContact?.name)],
  ['some', license => isString(license?.contactDetails?.technicalContact?.phone)],
  ['some', license => isString(license?.contactDetails?.technicalContact?.city)],
  ['some', license => isString(license?.contactDetails?.technicalContact?.state)],

  ['some', license => isString(license?.contactDetails?.billingContact?.email)],
  ['some', license => isString(license?.contactDetails?.billingContact?.name)],
  ['some', license => isString(license?.contactDetails?.billingContact?.phone)],
  ['some', license => isString(license?.contactDetails?.billingContact?.city)],
  ['some', license => isString(license?.contactDetails?.billingContact?.state)],

  ['some', license => isString(license?.partnerDetails?.billingContact?.email)],
  ['some', license => isString(license?.partnerDetails?.billingContact?.name)],

  ['every', license => isString(license?.contactDetails?.country)],
  ['every', license => isString(license?.contactDetails?.region)],
  ['every', license => isString(license?.hosting)],
  ['every', license => isString(license?.lastUpdated)],

  ['some', (/** @type {any} */ license) => isString(license?.evaluationLicense)],
  ['some', (/** @type {any} */ license) => isString(license?.daysToConvertEval)],
  ['some', (/** @type {any} */ license) => isString(license?.evaluationStartDate)],
  ['some', (/** @type {any} */ license) => isString(license?.evaluationEndDate)],
  ['some', (/** @type {any} */ license) => isString(license?.evaluationSaleDate)],
];

/** @type {Array<['every' | 'some', (license: License) => boolean]>} */
const licensesWithoutDataInsightsSchema = [
  ['every', license => isString(license?.contactDetails?.technicalContact?.email)],
  ['some', license => isString(license?.contactDetails?.technicalContact?.name)],
  ['some', license => isString(license?.contactDetails?.technicalContact?.phone)],
  ['some', license => isString(license?.contactDetails?.technicalContact?.city)],
  ['some', license => isString(license?.contactDetails?.technicalContact?.state)],

  ['some', license => isString(license?.contactDetails?.billingContact?.email)],
  ['some', license => isString(license?.contactDetails?.billingContact?.name)],
  ['some', license => isString(license?.contactDetails?.billingContact?.phone)],
  ['some', license => isString(license?.contactDetails?.billingContact?.city)],
  ['some', license => isString(license?.contactDetails?.billingContact?.state)],

  ['some', license => isString(license?.partnerDetails?.billingContact?.email)],
  ['some', license => isString(license?.partnerDetails?.billingContact?.name)],

  ['every', license => isString(license?.contactDetails?.country)],
  ['every', license => isString(license?.contactDetails?.region)],
  ['every', license => isString(license?.hosting)],
  ['every', license => isString(license?.lastUpdated)],

  ['every', (/** @type {any} */ license) => isUndefined(license?.evaluationLicense)],
  ['every', (/** @type {any} */ license) => isUndefined(license?.daysToConvertEval)],
  ['every', (/** @type {any} */ license) => isUndefined(license?.evaluationStartDate)],
  ['every', (/** @type {any} */ license) => isUndefined(license?.evaluationEndDate)],
  ['every', (/** @type {any} */ license) => isUndefined(license?.evaluationSaleDate)],
];

/** @type {Array<['every' | 'some', (transaction: Transaction) => boolean]>} */
const transactionsSchema = [
  ['some', transaction => isString(transaction?.partnerDetails?.billingContact?.email)],
  ['some', transaction => isString(transaction?.partnerDetails?.billingContact?.name)],

  ['some', transaction => isString(transaction?.customerDetails?.billingContact?.email)],
  ['some', transaction => isString(transaction?.customerDetails?.billingContact?.name)],

  ['some', transaction => isString(transaction?.customerDetails?.technicalContact?.email)],
  ['some', transaction => isString(transaction?.customerDetails?.technicalContact?.name)],

  ['every', transaction => isString(transaction?.customerDetails?.country)],
  ['every', transaction => isString(transaction?.customerDetails?.region)],
  ['every', transaction => isString(transaction?.purchaseDetails?.hosting)],
  ['every', transaction => isString(transaction?.purchaseDetails?.saleDate)],
];

/**
 * @param {string | undefined} s
 */
function isString(s) {
  return typeof s === 'string' && s.length > 0;
}

/**
 * @param {any} s
 */
function isUndefined(s) {
  return typeof s === 'undefined';
}

/**
 * @param {string[]} tlds
 */
function makeEmailValidationRegex(tlds) {
  const re = new RegExp(`.+@.+\\.(${tlds.join('|')})`);
  return re;
}

/**
 * @param {Transaction | License} item
 */
function getEmails(item) {
  if ('contactDetails' in item) {
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

/**
 * @param {RegExp} re
 */
function makeEmailValidator(re) {
  /**
   * @param {Transaction | License} item
   */
  return (item) =>
    getEmails(item).every(e => re.test(e));
}
