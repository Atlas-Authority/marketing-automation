import Chance from 'chance';
import { DateTime } from 'luxon';
import { RawDataSet } from '../../lib/data/raw';
import { DataSet } from '../../lib/data/set';
import { Action } from "../../lib/deal-generator/actions";
import { DealRelevantEvent } from '../../lib/deal-generator/events';
import { Engine, EngineConfig } from '../../lib/engine/engine';
import {DealStage, FullEntity} from '../../lib/hubspot/interfaces'
import {RawLicense, RawLicenseContact, RawTransaction, RawTransactionContact} from '../../lib/marketplace/raw';
import { Company } from '../../lib/model/company';
import { Contact } from '../../lib/model/contact';
import { Deal } from "../../lib/model/deal";
import { License } from "../../lib/model/license";

const chance = new Chance();

export type TestInput = {
  addonKey?: string,
  deals?: Deal[];
  contacts?: Contact[];
  companies?: Company[];
  records: ReturnType<typeof abbrRecordDetails>[];
  partnerLicenseIds?: string[];
  uniqueEmailForLicenses?: string[];
};

export function runDealGeneratorTwice(input: TestInput) {
  const { dataSet, config } = processInput(input);
  const output = runDealGeneratorWith(dataSet, config);
  return runDealGeneratorWith(DataSet.fromDataSet(output.dataSet), config);
}

export function runDealGenerator(input: TestInput) {
  const { dataSet, config } = processInput(input);
  return runDealGeneratorWith(dataSet, config);
}

function runDealGeneratorWith(dataSet: DataSet, config: EngineConfig) {
  const engine = new Engine(config);
  const engineResults = engine.run(dataSet);
  const dealGeneratorResults = engineResults.dealGeneratorResults.get(engine.mpac.licenses[0].id)!;
  dataSet.hubspot.populateFakeIds();
  return {
    dataSet,
    deals: dataSet.hubspot.dealManager.getArray(),
    contacts: dataSet.hubspot.contactManager.getArray(),
    companies: dataSet.hubspot.companyManager.getArray(),
    actions: dealGeneratorResults.actions.map(abbrActionDetails),
    events: dealGeneratorResults.events.map(abbrEventDetails),
  };
}

function processInput(input: TestInput): { config: EngineConfig; dataSet: DataSet; } {
  const data: RawDataSet = {
    rawCompanies: [],
    rawContacts: [],
    rawDeals: [],
    transactions: [],
    licensesWithoutDataInsights: [],
    licensesWithDataInsights: [],
    freeDomains: [],
    tlds: [],
  };

  const config: EngineConfig = {
    partnerDomains: new Set(),
    appToPlatform: Object.create(null),
  };

  const addonKey = input.addonKey || chance.word({ capitalize: false, syllables: 3 });

  const baseTechContact: RawLicenseContact = {
    email: chance.email(),
    address1: chance.address(),
    phone: chance.phone(),
    name: chance.name(),
  };

  for (const [id, start, licenseType, status, txSpec] of input.records) {
    const techContact: RawLicenseContact = { ...baseTechContact };

    if (input.uniqueEmailForLicenses?.includes(id)) {
      techContact.email = chance.email();
    }

    if (input.partnerLicenseIds?.includes(id)) {
      config.partnerDomains?.add(techContact.email.split('@')[1]);
    }

    const rawLicense = rawLicenseFrom(id, addonKey, techContact, start, licenseType, status);
    data.licensesWithDataInsights.push(rawLicense);
    config.appToPlatform![rawLicense.addonKey] = 'Confluence';
    for (const [txId, txLineId, saleDate, saleType, vendorAmount] of txSpec) {
      const rawTransaction = rawTransactionFrom(rawLicense, txId, txLineId, saleDate, saleType, vendorAmount);
      data.transactions.push(rawTransaction);
    }
  }

  input.deals?.forEach(deal => data.rawDeals.push(rawDealFrom(deal, addonKey)))

  const dataSet = new DataSet(data, DateTime.now());

  return { config, dataSet };
}

function rawDealFrom({ id, data }:Deal, addonKey: string): FullEntity {
  return {
    id: id!,
    properties: {
      aa_app: addonKey,
      addonLicenseId: data.addonLicenseId!,
      amount: String(data.amount!),
      appEntitlementId: data.addonLicenseId!,
      appEntitlementNumber: data.addonLicenseId!,
      dealname: `Deal: ${data.addonLicenseId}`,
      transactionId: data.transactionId!,
      transactionLineItemId: data.transactionLineItemId || '',
      licenseTier: 'Unlimited Users',
      maintenance_end_date: data.maintenanceEndDate!,
      pipeline: 'Pipeline',
      closedate: data.closeDate + 'T00:00:00Z',
      dealstage: 'ClosedWon'
    },
    associations: []
  }
}

function rawLicenseFrom(id: string, addonKey: string, techContact: RawLicenseContact, start: string, licenseType: string, status: string): RawLicense {
  return {
    addonKey,
    addonName: chance.sentence({ words: 3, punctuation: false }),
    hosting: 'Server',
    lastUpdated: start,
    contactDetails: {
      company: chance.company(),
      country: chance.country(),
      region: chance.pickone(['EMEA', 'Americas', 'APAC', 'Unknown']),
      technicalContact: techContact,
    },
    addonLicenseId: id,
    appEntitlementId: id,
    appEntitlementNumber: id,
    licenseId: id,
    licenseType: licenseType as any,
    maintenanceStartDate: start,
    maintenanceEndDate: start,
    status: status as any,
    tier: 'Unlimited Users',
  };
}

function rawTransactionFrom(rawLicense: RawLicense, txId: string, txLineId: string, saleDate: string, saleType: string, vendorAmount: number): RawTransaction {
  return {
    appEntitlementId: rawLicense.appEntitlementId,
    licenseId: rawLicense.appEntitlementId!,
    addonKey: rawLicense.addonKey,
    addonName: rawLicense.addonName,
    lastUpdated: rawLicense.lastUpdated,
    customerDetails: {
      ...rawLicense.contactDetails,
      company: rawLicense.contactDetails.company ?? 'random company',
      country: rawLicense.contactDetails.country ?? 'us',
      region: rawLicense.contactDetails.region ?? 'CA',
      technicalContact: rawLicense.contactDetails.technicalContact ?? { email: 'technical_contact@example.com'}
    },
    transactionId: txId,
    transactionLineItemId: txLineId,
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
        transactionLineItemId: action.properties.transactionLineItemId,
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

export function abbrRecordDetails(license: License) {
  return [
    license.id,
    license.data.maintenanceStartDate,
    license.data.licenseType,
    license.data.status,
    license.transactions.map(transaction => [
      transaction.data.transactionId,
      transaction.data.transactionLineItemId,
      transaction.data.saleDate,
      transaction.data.saleType,
      transaction.data.vendorAmount,
    ] as const)
  ] as const;
}
