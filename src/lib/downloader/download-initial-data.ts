import assert from 'assert';
import util from 'util';
import { Company } from '../types/company.js';
import { Contact } from '../types/contact.js';
import { makeMultiProviderDomainsSet } from '../util/domains.js';
import { AttachableError } from '../util/errors.js';
import { isPresent } from '../util/helpers.js';
import logger from '../util/logger.js';
import { Downloader } from './downloader.js';

type InitialData = {
  providerDomains: Set<string>,
  allLicenses: License[],
  allTransactions: Transaction[],
  allContacts: Contact[],
  allDeals: Deal[],
  allCompanies: Company[],
};


export async function downloadAllData({ downloader }: { downloader: Downloader }): Promise<InitialData> {
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

  licensesWithDataInsights = licensesWithDataInsights.filter(filterLicensesWithTechEmail);
  licensesWithoutDataInsights = licensesWithoutDataInsights.filter(filterLicensesWithTechEmail);

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

function uniqLicenses(licenses: License[]) {
  const groups: { [addonLicenseId: string]: License[] } = {};

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

function verifyStructure<T>(name: string, data: T[], schema: Array<['every' | 'some', (license: T) => boolean]>) {
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

const licensesWithDataInsightsSchema: Array<['every' | 'some', (license: License) => boolean]> = [
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

  ['every', license => isString(license?.parentProductBillingCycle)],
  ['every', license => isString(license?.parentProductName)],
  ['every', license => isString(license?.installedOnSandbox)],
  ['every', license => isString(license?.parentProductEdition)],

  ['some', (license: any) => isString(license?.evaluationLicense)],
  ['some', (license: any) => isString(license?.daysToConvertEval)],
  ['some', (license: any) => isString(license?.evaluationStartDate)],
  ['some', (license: any) => isString(license?.evaluationEndDate)],
  ['some', (license: any) => isString(license?.evaluationSaleDate)],
];

const licensesWithoutDataInsightsSchema: Array<['every' | 'some', (license: License) => boolean]> = [
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

  ['every', (license: any) => isUndefined(license?.evaluationLicense)],
  ['every', (license: any) => isUndefined(license?.daysToConvertEval)],
  ['every', (license: any) => isUndefined(license?.evaluationStartDate)],
  ['every', (license: any) => isUndefined(license?.evaluationEndDate)],
  ['every', (license: any) => isUndefined(license?.evaluationSaleDate)],
];

const transactionsSchema: Array<['every' | 'some', (transaction: Transaction) => boolean]> = [
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

function isString(s: string | undefined) {
  return typeof s === 'string' && s.length > 0;
}

function isUndefined(s: any) {
  return typeof s === 'undefined';
}

function makeEmailValidationRegex(tlds: string[]) {
  const re = new RegExp(`.+@.+\\.(${tlds.join('|')})`);
  return re;
}

function getEmails(item: Transaction | License) {
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

function makeEmailValidator(re: RegExp) {
  return (item: Transaction | License) => (
    getEmails(item).every(e => re.test(e))
  );
}

function filterLicensesWithTechEmail(license: License) {
  if (!license.contactDetails.technicalContact?.email) {
    logger.warn('Downloader', 'License does not have a tech contact email; will be skipped', license);
    return false;
  }
  return true;
}
