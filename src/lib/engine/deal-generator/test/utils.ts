import { Chance } from 'chance';
import { DealData, DealManager } from "../../../model/deal";
import { FullEntity } from "../../../model/hubspot/interfaces";
import { License, LicenseData } from "../../../model/license";
import { Transaction, TransactionData } from "../../../model/transaction";
import env from "../../../parameters/env";
import { Action, ActionGenerator } from "../actions";
import { DealRelevantEvent, EventGenerator } from "../events";
import { InMemoryHubspot } from "./in-memory-hubspot";

const chance = new Chance();

export type RecordJson = {
  transactions: Pick<
    TransactionData,
    'licenseId' |
    'hosting' |
    'addonLicenseId' |
    'maintenanceStartDate' |
    'maintenanceEndDate' |
    'licenseType' |
    'saleType' |
    'saleDate' |
    'transactionId' |
    'vendorAmount' |
    'company' |
    'country' |
    'addonKey' |
    'addonName' |
    'tier'
  >[],
  license: Pick<
    LicenseData,
    'addonLicenseId' |
    'licenseId' |
    'addonKey' |
    'addonName' |
    'company' |
    'country' |
    'tier' |
    'licenseType' |
    'hosting' |
    'maintenanceStartDate' |
    'maintenanceEndDate' |
    'status' |
    'evaluationOpportunitySize'
  >,
}[]

export type ExpectedEvent = {
  type: DealRelevantEvent['type'],
  licenseIds: (string | undefined)[],
  transactionIds: (string | undefined)[],
}

export type ExpectedAction = Omit<DealData, 'relatedProducts' | 'origin'> & {
  type: Action['type'],
}

export const verifyDealGeneration = (
  dealData: Record<string, string>[],
  recordData: RecordJson,
  expectedEvents: ExpectedEvent[],
  expectedActions: ExpectedAction[],
) => {
  const dealEntities = buildDeals(dealData);
  const dealManager = createTestDealManager(dealEntities);
  const records = buildRecords(recordData);

  const events = new EventGenerator().interpretAsEvents(records);

  it('Verify generated events', () => {
    assertEvents(events, expectedEvents);
  });

  it('Verify generated actions', () => {
    const actions = new ActionGenerator(dealManager).generateFrom(events);
    assertActions(actions, expectedActions);
  });
}

const createTestDealManager = (deals: FullEntity[]): DealManager => {
  const hubspotService = new InMemoryHubspot(deals, [], []);
  return new DealManager(hubspotService, hubspotService);
}

const buildDeals = (dealJson: Record<string, string>[]): FullEntity[] => {
  return dealJson.map(properties => ({
    id: uniqueId('DEAL-'),
    properties,
    associations: [],
  }));
}

const buildRecords = (recordJson: RecordJson): (License | Transaction)[] => {
  return recordJson.flatMap(json => {
    const { transactions, license } = json;
    const technicalContact = {
      email: chance.email(),
      name: chance.name(),
    };
    const billingContact = {
      email: chance.email(),
      name: chance.name(),
    };
    return [
      new License({
        ...license,
        lastUpdated: chance.date().toDateString(),
        technicalContact,
        billingContact,
        partnerDetails: null,
        region: chance.string(),
        attribution: null,
        parentInfo: null,
        newEvalData: null,
      }),
      ...transactions.map(transaction => new Transaction({
        ...transaction,
        lastUpdated: chance.date().toDateString(),
        technicalContact,
        billingContact,
        partnerDetails: null,
        region: chance.string(),
        purchasePrice: chance.integer(),
        billingPeriod: chance.string(),
      })),
    ];
  });
}

const assertEvents = (actualEvents: DealRelevantEvent[], expectedEvents: ExpectedEvent[]) => {
  expect(actualEvents).toHaveLength(expectedEvents.length);

  for (const [index, actual] of actualEvents.entries()) {
    const expected = expectedEvents[index];

    expect(actual.type).toEqual(expected.type);

    const { licenseIds, transactionIds } = getRecordIds(actual);

    expect(licenseIds).toEqual(expected.licenseIds);

    expect(transactionIds).toEqual(expected.transactionIds);
  }
}

const assertActions = (actualActions: Action[], expectedActions: ExpectedAction[]) => {
  expect(actualActions).toHaveLength(expectedActions.length);

  for (const [index, actual] of actualActions.entries()) {
    const expected = expectedActions[index];

    expect(actual.type).toEqual(expected.type);

    let actualProperties = actual.type === 'noop' ? actual.deal.data : actual.properties;
    for (const [field, expectedValue] of Object.entries(expected)) {
      if (field !== 'type') {
        // @ts-ignore
        expect(actualProperties[field]).toEqual(expectedValue);
      }
    }

    expect(actualProperties.relatedProducts).toEqual(env.hubspot.deals.dealRelatedProducts);
    expect(actualProperties.origin).toEqual(env.hubspot.deals.dealOrigin);
  }
}

const getRecordIds = (event: DealRelevantEvent): { licenseIds: (string | undefined)[], transactionIds: (string | undefined)[] } => {
  switch (event.type) {
    case 'eval': return {
      licenseIds: event.licenses.map(license => license.id),
      transactionIds: [],
    };
    case 'purchase': return {
      licenseIds: event.licenses.map(license => license.id),
      transactionIds: event.transaction ? [event.transaction.id] : [],
    };
    case 'refund': return {
      licenseIds: [],
      transactionIds: event.refundedTxs.map(tx => tx.id),
    };
    case 'renewal': return {
      licenseIds: [],
      transactionIds: [event.transaction.id],
    };
    case 'upgrade': return {
      licenseIds: [],
      transactionIds: [event.transaction.id],
    };
  }
}

const ids = new Set<string>();
const uniqueId = (prefix: string): string => {
  let key: string;
  do { key = prefix + chance.string() } while (ids.has(key));
  ids.add(key);
  return key;
}
