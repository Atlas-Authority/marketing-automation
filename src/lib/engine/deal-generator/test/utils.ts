import { IO } from '../../../io/io';
import { Database } from '../../../model/database';
import { DealData } from "../../../model/deal";
import { License, LicenseData } from "../../../model/license";
import { Transaction, TransactionData } from "../../../model/transaction";
import { LicenseContext, RelatedLicenseSet } from '../../license-matching/license-grouper';
import { Action } from "../actions";
import { DealRelevantEvent } from '../events';
import { DealGenerator } from '../generate-deals';


export function runDealGenerator(input: TypeInput) {
  const io = new IO();
  const db = new Database(io);

  const group = rebuildMatchGroup(input.matchGroup);
  db.licenses = group.map(g => g.license);
  db.transactions = group.flatMap(g => g.transactions);

  for (const [i, dealData] of input.deals.entries()) {
    const deal = db.dealManager.create(dealData);
    deal.id = `deal-${i}`;
    deal.applyPropertyChanges();
  }

  const dealGenerator = new DealGenerator(db);
  const { events, actions } = dealGenerator.generateActionsForMatchedGroup(group);
  return {
    events: events.map(abbrEventDetails),
    actions: actions.map(abbrActionDetails),
  };
}

function rebuildMatchGroup(input: { license: LicenseData, transactions: TransactionData[] }[]): RelatedLicenseSet {
  const group: RelatedLicenseSet = [];
  for (const { license: licenseData, transactions: transactionsDatas } of input) {
    const license = new License(licenseData);
    const context: LicenseContext = { license, transactions: [] };
    for (const transactionData of transactionsDatas) {
      const transaction = new Transaction(transactionData);
      transaction.context = context;
      transaction.matches = group;
      context.transactions.push(transaction);
    }
    license.context = context;
    license.matches = group;
    group.push(context);
  }
  return group;
}

type TypeInput = {
  deals: DealData[],
  matchGroup: {
    license: LicenseData;
    transactions: TransactionData[];
  }[],
};

export function abbrEventDetails(e: DealRelevantEvent) {
  switch (e.type) {
    case 'eval': return { type: e.type, lics: e.licenses.map(l => l.id) };
    case 'purchase': return { type: e.type, lics: e.licenses.map(l => l.id), txs: [e.transaction?.id] };
    case 'refund': return { type: e.type, txs: e.refundedTxs.map(tx => tx.id) };
    case 'renewal': return { type: e.type, txs: [e.transaction.id] };
    case 'upgrade': return { type: e.type, txs: [e.transaction.id] };
  }
}

export function abbrActionDetails(action: Action) {
  switch (action.type) {
    case 'create': return {
      type: action.type,
      data: action.properties,
    };
    case 'update': return {
      type: action.type,
      deal: action.deal.id,
      data: action.properties,
    };
    case 'noop': return {
      type: action.type,
      deal: action.deal.id,
    };
  }
}
