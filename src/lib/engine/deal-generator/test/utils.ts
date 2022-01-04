import Chance from 'chance';
import { IO } from '../../../io/io';
import { Database } from '../../../model/database';
import { DealData } from "../../../model/deal";
import { DealStage } from '../../../model/hubspot/interfaces';
import { License, LicenseData } from "../../../model/license";
import { ContactInfo } from '../../../model/marketplace/common';
import { Transaction, TransactionData } from "../../../model/transaction";
import { emptyConfig } from '../../../parameters/env-config';
import { ContactGenerator } from '../../contacts/generate-contacts';
import { RelatedLicenseSet } from '../../license-matching/license-grouper';
import { Action } from "../actions";
import { DealRelevantEvent } from '../events';
import { DealGenerator } from '../generate-deals';

const chance = new Chance();

export type TestInput = {
  deals?: DealData[];
  records: (License | Transaction)[];
  group: [string, string[]][];
  partnerDomains?: string[],
};

export function runDealGeneratorTwice(input: TestInput) {
  const output = runDealGenerator(input);
  return runDealGenerator({ ...input, deals: output.createdDeals });
}

export function runDealGenerator(input: TestInput) {
  const io = new IO();
  const db = new Database(io, {
    ...emptyConfig,
    partnerDomains: input.partnerDomains ?? [],
  });
  const group = reassembleMatchGroup(input.group, input.records);
  db.licenses = group;
  db.transactions = group.flatMap(g => g.transactions);

  new ContactGenerator(db).run();

  for (const [i, dealData] of (input.deals ?? []).entries()) {
    const deal = db.dealManager.create(dealData);
    deal.id = `deal-${i}`;
    deal.applyPropertyChanges();
  }

  const dealGenerator = new DealGenerator(db);
  const { records, events, actions } = dealGenerator.generateActionsForMatchedGroup(group);

  for (const deal of db.dealManager.getAll()) {
    deal.records = records;
    dealGenerator.flagPartnerTransacted(deal);
  }

  const createdDeals: DealData[] = [];
  for (const [i, action] of actions.entries()) {
    if (action.type === 'create') {
      createdDeals.push(action.properties);
    }
  }

  return {
    events: events.map(abbrEventDetails),
    actions: actions.map(abbrActionDetails),
    createdDeals,
    db,
  };
}

type RecordFilter<T extends License | Transaction> = (r: (License | Transaction)) => r is T;

function reassembleMatchGroup(ids: [string, string[]][], records: (License | Transaction)[]) {
  const licenses: License[] = records.filter((r => r instanceof License) as RecordFilter<License>);
  const transactions: Transaction[] = records.filter((r => r instanceof Transaction) as RecordFilter<Transaction>);

  const group: RelatedLicenseSet = [];
  for (const [lid, txids] of ids) {
    const license = licenses.find(l => l.id === lid)!;
    license.transactions = [];
    for (const tid of txids) {
      const transaction = transactions.find(t => t.id === tid)!;
      license.transactions.push(transaction);
      transaction.license = license;
    }
    group.push(license);
  }
  return group;
}

function fakeContact(email?: string): ContactInfo {
  return {
    email: email ?? chance.email(),
    name: chance.name(),
  };
}

export function testTransaction(
  addonLicenseId: string,
  maintenanceStartDate: string,
  licenseType: string,
  saleType: string,
  transactionId: string,
  vendorAmount: number,
) {
  return new Transaction({
    ...testRecordCommon(addonLicenseId, maintenanceStartDate),

    tier: 'Unlimited Users',
    licenseType: licenseType as TransactionData['licenseType'],
    hosting: 'Server',
    maintenanceStartDate,
    maintenanceEndDate: maintenanceStartDate,

    transactionId,
    saleDate: maintenanceStartDate,
    saleType: saleType as TransactionData['saleType'],

    billingPeriod: "Monthly",

    purchasePrice: vendorAmount! + 111,
    vendorAmount: vendorAmount!,
  });
}

export function testLicense(
  addonLicenseId: string,
  maintenanceStartDate: string,
  licenseType: string,
  status: string,
  email?: string,
) {
  return new License({
    ...testRecordCommon(addonLicenseId, maintenanceStartDate, email),

    tier: 'Unlimited Users',
    licenseType: licenseType as LicenseData['licenseType'],
    hosting: 'Server',
    maintenanceStartDate,
    maintenanceEndDate: maintenanceStartDate,

    status: status as LicenseData['status'],

    evaluationOpportunitySize: 'NA',
    attribution: null,
    parentInfo: null,
    newEvalData: null,
  });
}

function testRecordCommon(addonLicenseId: string, maintenanceStartDate: string, email?: string) {
  return {
    addonLicenseId,
    licenseId: addonLicenseId,
    addonKey: chance.word({ capitalize: false, syllables: 3 }),
    addonName: chance.sentence({ words: 3, punctuation: false }),
    lastUpdated: maintenanceStartDate,

    technicalContact: fakeContact(email),
    billingContact: null,
    partnerDetails: null,

    company: chance.company(),
    country: chance.country(),
    region: chance.pickone(['EMEA', 'Americas', 'APAC', 'Unknown']),
  };
}

export function abbrEventDetails(e: DealRelevantEvent) {
  switch (e.type) {
    case 'eval': return [e.type, ...e.licenses.map(l => l.id)];
    case 'purchase': return [e.type, ...e.licenses.map(l => l.id), ... (e.transaction ? [e.transaction.id] : [])];
    case 'refund': return [e.type, ...e.refundedTxs.map(tx => tx.id)];
    case 'renewal': return [e.type, ...[e.transaction.id]];
    case 'upgrade': return [e.type, ...[e.transaction.id]];
  }
}

export function abbrActionDetails(action: Action) {
  switch (action.type) {
    case 'create': return {
      "Create": {
        dealStage: DealStage[action.properties.dealStage],
        addonLicenseId: action.properties.addonLicenseId,
        transactionId: action.properties.transactionId,
        closeDate: action.properties.closeDate,
        amount: action.properties.amount,
      },
    };
    case 'update': return {
      "Update":
        [action.deal.id,
        action.properties,]
    };
    case 'noop': return {
      "Nothing": [action.reason, action.deal && [
        action.deal.mpacId(),
        DealStage[action.deal.data.dealStage],
        action.deal.data.amount,
      ]]
    };
  }
}
