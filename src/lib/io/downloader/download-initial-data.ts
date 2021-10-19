import { MultiDownloadLogger } from '../../log/download-logger.js';
import log from '../../log/logger.js';
import { Company } from '../../types/company.js';
import { Contact } from '../../types/contact.js';
import { Deal } from '../../types/deal.js';
import { License } from '../../types/license.js';
import { RawLicense, RawTransaction } from "../../model/marketplace/raw";
import { Transaction } from '../../types/transaction.js';
import { Downloader } from './downloader.js';
import { Uploader } from '../uploader/uploader.js';
import ConsoleUploader from '../uploader/console-uploader.js';
import { Database } from '../../model/database.js';
import { validateMarketplaceData } from '../../model/marketplace/validation.js';

type InitialData = {
  providerDomains: Set<string>,
  allLicenses: License[],
  allTransactions: Transaction[],
  allContacts: Contact[],
  allDeals: Deal[],
  allCompanies: Company[],
  db: Database,
};


export async function downloadAllData({ downloader, uploader }: {
  downloader: Downloader,
  uploader?: Uploader,
}): Promise<InitialData> {
  log.info('Downloader', 'Starting downloads with API');

  if (!uploader) uploader = new ConsoleUploader({ verbose: true });

  const db = new Database(downloader, uploader);

  await db.downloadAllData();

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

  await Promise.all([
    db.downloadAllCompanies(multiDownloadLogger.makeDownloadLogger('DB-Companies')),
    db.downloadAllContacts(multiDownloadLogger.makeDownloadLogger('DB-Contacts')),
    db.downloadAllDeals(multiDownloadLogger.makeDownloadLogger('DB-Deals')),
  ]);

  multiDownloadLogger.done();

  log.info('Downloader', 'Done');

  const results = validateMarketplaceData(
    licensesWithDataInsights,
    licensesWithoutDataInsights,
    allTransactions,
    freeDomains,
    allTlds);

  return {
    providerDomains: results.providerDomains,
    allLicenses: results.allLicenses.map(normalizeLicense),
    allTransactions: results.allTransactions.map(normalizeTransaction),
    allContacts,
    allDeals,
    allCompanies,
    db,
  };
}

function normalizeLicense(license: RawLicense): License {
  return license;
}

function normalizeTransaction(transaction: RawTransaction): Transaction {
  return transaction;
}
