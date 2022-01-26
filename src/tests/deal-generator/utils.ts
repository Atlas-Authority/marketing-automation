import Chance from 'chance';
import { Data } from '../../lib/data/set';
import { Action } from "../../lib/deal-generator/actions";
import { DealRelevantEvent } from '../../lib/deal-generator/events';
import { Engine, EngineConfig } from '../../lib/engine/engine';
import { Hubspot } from '../../lib/hubspot';
import { DealStage } from '../../lib/hubspot/interfaces';
import { RawLicense, RawTransaction } from '../../lib/marketplace/raw';
import { DealData } from "../../lib/model/deal";
import { License } from "../../lib/model/license";
import { Transaction } from "../../lib/model/transaction";

const chance = new Chance();

type LicenseSpec = [
  typeof License.prototype.id,
  typeof License.prototype.data.maintenanceStartDate,
  typeof License.prototype.data.licenseType,
  typeof License.prototype.data.status,
  [
    typeof Transaction.prototype.data.transactionId,
    typeof Transaction.prototype.data.saleDate,
    typeof Transaction.prototype.data.saleType,
    typeof Transaction.prototype.data.vendorAmount,
  ][]
];

export type TestInput = {
  deals?: DealData[];
  records: LicenseSpec[];
  partnerDomains?: string[],
};

export function runDealGeneratorTwice(input: TestInput) {
  const output = runDealGenerator(input);
  return runDealGenerator({ ...input, deals: output.createdDeals });
}

export function runDealGenerator(input: TestInput) {
  const { config, data } = processInput(input);
  const engine = new Engine(Hubspot.memory(), config);
  const results = engine.run(data);
  const [[firstLicenseId,],] = input.records;
  // console.log({ firstLicenseId, results: results.dealGeneratorResults })
  return results.dealGeneratorResults.get(firstLicenseId)!;
}

function processInput(input: TestInput): { config: EngineConfig; data: Data; } {
  const data: Data = {
    rawCompanies: [],
    rawContacts: [],
    transactions: [],
    rawDeals: [],
    licensesWithoutDataInsights: [],
    licensesWithDataInsights: [],
    freeDomains: [],
    tlds: [],
  };

  const config: EngineConfig = {
    partnerDomains: new Set(input.partnerDomains ?? []),
    appToPlatform: Object.create(null),
  };

  for (const [id, start, licenseType, status, txSpec] of input.records) {
    const email = chance.email();

    const rawLicense = rawLicenseFrom(id, email, start, licenseType, status);
    data.licensesWithDataInsights.push(rawLicense);
    config.appToPlatform![rawLicense.addonKey] = 'Confluence';
    for (const [txId, saleDate, saleType, vendorAmount] of txSpec) {
      const rawTransaction = rawTransactionFrom(rawLicense, txId, saleDate, saleType, vendorAmount);
      data.transactions.push(rawTransaction);
    }
  }

  return { config, data };
}

function rawLicenseFrom(id: string, email: string, start: string, licenseType: string, status: string): RawLicense {
  return {
    addonKey: chance.word({ capitalize: false, syllables: 3 }),
    addonName: chance.sentence({ words: 3, punctuation: false }),
    hosting: 'Server',
    lastUpdated: start,
    contactDetails: {
      company: chance.company(),
      country: chance.country(),
      region: chance.pickone(['EMEA', 'Americas', 'APAC', 'Unknown']),
      technicalContact: {
        email,
      },
    },
    appEntitlementId: id,
    licenseId: id,
    licenseType: licenseType as any,
    maintenanceStartDate: start,
    maintenanceEndDate: start,
    status: status as any,
    tier: 'Unlimited Users',
  };
}

function rawTransactionFrom(rawLicense: RawLicense, txId: string, saleDate: string, saleType: string, vendorAmount: number): RawTransaction {
  return {
    appEntitlementId: rawLicense.appEntitlementId,
    licenseId: rawLicense.appEntitlementId!,
    addonKey: rawLicense.addonKey,
    addonName: rawLicense.addonName,
    lastUpdated: rawLicense.lastUpdated,
    customerDetails: rawLicense.contactDetails,
    transactionId: txId,
    purchaseDetails: {
      billingPeriod: "Monthly",
      tier: 'Unlimited Users',
      saleDate,
      maintenanceStartDate: saleDate,
      maintenanceEndDate: saleDate,
      hosting: 'Server',
      licenseType: rawLicense.licenseType as any,
      purchasePrice: vendorAmount + 1,
      vendorAmount,
      saleType: saleType as any,
    },
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
        addonLicenseId: action.properties.addonLicenseId ?? action.properties.appEntitlementId ?? action.properties.appEntitlementNumber!,
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
        [...new Set(action.deal.getMpacIds())].join(','),
        DealStage[action.deal.data.dealStage],
        action.deal.data.amount,
      ]]
    };
  }
}
