import assert from 'assert';
import util from 'util';
import { getEmails, isLicense } from '../engine/deal-generator/records.js';
import { Company } from '../types/company.js';
import { Contact } from '../types/contact.js';
import { Deal } from '../types/deal.js';
import { License } from '../types/license.js';
import { Transaction } from '../types/transaction.js';
import { makeMultiProviderDomainsSet } from '../util/domains.js';
import { AttachableError } from '../util/errors.js';
import log from '../log/logger.js';
import { MultiDownloadLogger } from '../log/download-logger.js';
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
  log.info('Downloader', 'Starting downloads with API');

  const multiDownloadLogger = new MultiDownloadLogger();

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
    downloader.downloadFreeEmailProviders(multiDownloadLogger.makeDownloadLogger('Free Email Providers')),
    downloader.downloadLicensesWithDataInsights(multiDownloadLogger.makeDownloadLogger('Licenses With Data Insights')),
    downloader.downloadLicensesWithoutDataInsights(multiDownloadLogger.makeDownloadLogger('Licenses Without Data Insights')),
    downloader.downloadTransactions(multiDownloadLogger.makeDownloadLogger('Transactions')),
    downloader.downloadAllContacts(multiDownloadLogger.makeDownloadLogger('Contacts')),
    downloader.downloadAllDeals(multiDownloadLogger.makeDownloadLogger('Deals')),
    downloader.downloadAllCompanies(multiDownloadLogger.makeDownloadLogger('Companies')),
    downloader.downloadAllTlds(multiDownloadLogger.makeDownloadLogger('Tlds')),
  ]);

  multiDownloadLogger.done();

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

  log.info('Downloader', 'Done');

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
  log.info('Downloader', 'Verifying schema for:', name);
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

  ['some', license => isNonBlankString(license?.parentProductBillingCycle)],
  ['some', license => isNonBlankString(license?.parentProductName)],
  ['some', license => isNonBlankString(license?.installedOnSandbox)],
  ['some', license => isNonBlankString(license?.parentProductEdition)],

  ['some', license => isNonBlankString(license?.evaluationLicense)],
  ['some', license => isNonBlankString(license?.daysToConvertEval)],
  ['some', license => isNonBlankString(license?.evaluationStartDate)],
  ['some', license => isNonBlankString(license?.evaluationEndDate)],
  ['some', license => isNonBlankString(license?.evaluationSaleDate)],
];

const licensesWithoutDataInsightsSchema: Array<['every' | 'some', (license: License) => boolean]> = [
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

const transactionsSchema: Array<['every' | 'some', (transaction: Transaction) => boolean]> = [
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

function makeEmailValidationRegex(tlds: string[]) {
  const re = new RegExp(`.+@.+\\.(${tlds.join('|')})`);
  return re;
}

function makeEmailValidator(re: RegExp) {
  return (item: Transaction | License) => {
    if (!getEmails(item).every(e => re.test(e))) {
      if (isLicense(item)) {
        log.warn('Downloader', 'License has invalid email(s); will be skipped:', item.addonLicenseId);
      }
      else {
        log.warn('Downloader', 'Transaction has invalid email(s); will be skipped:', item.transactionId);
      }
      return false;
    }
    return true;
  };
}

function filterLicensesWithTechEmail(license: License) {
  if (!license.contactDetails.technicalContact?.email) {
    log.warn('Downloader', 'License does not have a tech contact email; will be skipped', license.addonLicenseId);
    return false;
  }
  return true;
}

function fixOdditiesInLicenses(license: License) {
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
