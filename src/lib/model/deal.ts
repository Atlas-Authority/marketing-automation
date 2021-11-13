import env from "../parameters/env.js";
import { AttachableError } from "../util/errors.js";
import { isPresent } from "../util/helpers.js";
import { Company } from "./company.js";
import { Contact } from "./contact.js";
import { Entity } from "./hubspot/entity.js";
import { DealStage, EntityKind, Pipeline } from "./hubspot/interfaces.js";
import { EntityAdapter, EntityManager } from "./hubspot/manager.js";
import { License } from "./license.js";
import { Transaction } from "./transaction.js";

const addonLicenseIdKey = env.hubspot.attrs.deal.addonLicenseId;
const transactionIdKey = env.hubspot.attrs.deal.transactionId;
const deploymentKey = env.hubspot.attrs.deal.deployment;
const appKey = env.hubspot.attrs.deal.app;

export type DealData = {
  relatedProducts: string | null;
  app: string | null;
  addonLicenseId: string;
  transactionId: string | null;
  closeDate: string;
  country: string;
  dealName: string;
  origin: string | null;
  deployment: 'Server' | 'Cloud' | 'Data Center' | null;
  licenseTier: number;
  pipeline: Pipeline;
  dealStage: DealStage;
  amount: number | null;
};

type DealComputed = {
  readonly hasActivity: boolean;
};

export class Deal extends Entity<DealData, DealComputed> {

  contacts = this.makeDynamicAssociation<Contact>('contact');
  companies = this.makeDynamicAssociation<Company>('company');

  mpacId() {
    if (this.data.transactionId && this.data.addonLicenseId) {
      return `${this.data.transactionId}[${this.data.addonLicenseId}]`;
    }
    else {
      return this.data.addonLicenseId;
    }
  }

  get isWon() { return this.data.dealStage === DealStage.CLOSED_WON }
  get isLost() { return this.data.dealStage === DealStage.CLOSED_LOST }

  isEval() { return this.data.dealStage === DealStage.EVAL; }
  isClosed() { return this.isWon || this.isLost; }

  public link() {
    const hsAccountId = env.hubspot.accountId;
    return (hsAccountId
      ? `https://app.hubspot.com/contacts/${hsAccountId}/deal/${this.id}/`
      : `deal-id=${this.id}`);
  }

}

const DealAdapter: EntityAdapter<DealData, DealComputed> = {

  associations: [
    ['company', 'down/up'],
    ['contact', 'down/up'],
  ],

  shouldReject(data) {
    return (data['pipeline'] !== env.hubspot.pipeline.mpac);
  },

  data: {
    relatedProducts: { property: 'related_products', down: related_products => related_products || null, },
    app: { property: appKey, down: app => appKey ? app as string : null, },
    addonLicenseId: { property: addonLicenseIdKey, down: addonLicenseId => addonLicenseId as string, },
    transactionId: { property: transactionIdKey, down: transactionId => transactionId, },
    closeDate: { property: 'closedate', down: closedate => (closedate as string).substr(0, 10), },
    country: { property: 'country', down: country => country as string, },
    dealName: { property: 'dealname', down: dealname => dealname as string, },
    origin: { property: 'origin', down: origin => origin || null, },
    deployment: { property: deploymentKey, down: deployment => deployment as DealData['deployment'], },
    licenseTier: { property: 'license_tier', down: license_tier => +(license_tier as string), },
    pipeline: { property: 'pipeline', down: data => Pipeline.MPAC, },
    dealStage: { property: 'dealstage', down: dealstage => enumFromValue(dealstages, dealstage ?? ''), },
    amount: { property: 'amount', down: amount => !amount ? null : +amount, },
  },

  computed: {
    hasActivity: {
      default: false,
      down: data => (
        isNonBlankString(data['hs_user_ids_of_all_owners']) ||
        isNonBlankString(data['engagements_last_meeting_booked']) ||
        isNonBlankString(data['hs_latest_meeting_activity']) ||
        isNonBlankString(data['notes_last_contacted']) ||
        isNonBlankString(data['notes_last_updated']) ||
        isNonBlankString(data['notes_next_activity_date']) ||
        isNonBlankString(data['hs_sales_email_last_replied']) ||
        isNonZeroNumberString(data['num_contacted_notes']) ||
        isNonZeroNumberString(data['num_notes'])
      ),
      properties: [
        'hs_user_ids_of_all_owners',
        'engagements_last_meeting_booked',
        'hs_latest_meeting_activity',
        'notes_last_contacted',
        'notes_last_updated',
        'notes_next_activity_date',
        'num_contacted_notes',
        'num_notes',
        'hs_sales_email_last_replied',
      ]
    },
  },

  toAPI: {
    relatedProducts: relatedProducts => ['related_products', relatedProducts ?? ''],
    app: EntityManager.upSyncIfConfigured(appKey, app => app ?? ''),
    addonLicenseId: addonLicenseId => [addonLicenseIdKey, addonLicenseId || ''],
    transactionId: transactionId => [transactionIdKey, transactionId || ''],
    closeDate: closeDate => ['closedate', closeDate],
    country: country => ['country', country],
    dealName: dealName => ['dealname', dealName],
    origin: origin => ['origin', origin ?? ''],
    deployment: EntityManager.upSyncIfConfigured(deploymentKey, deployment => deployment ?? ''),
    licenseTier: licenseTier => ['license_tier', licenseTier.toFixed()],
    pipeline: pipeline => ['pipeline', pipelines[pipeline]],
    dealStage: dealstage => ['dealstage', dealstages[dealstage]],
    amount: amount => ['amount', amount?.toString() ?? ''],
  },

  identifiers: [
    'addonLicenseId',
    'transactionId',
  ],

};

export class DealManager extends EntityManager<DealData, DealComputed, Deal> {

  override Entity = Deal;
  override kind: EntityKind = 'deal';
  override entityAdapter = DealAdapter;

  /** Either `License.addonLicenseId` or `Transaction.transactionId[Transacton.addonLicenseId]` */
  public getByMpacId = this.makeIndex(d => [d.mpacId()].filter(isPresent), ['transactionId', 'addonLicenseId']);

  duplicatesToDelete = new Map<Deal, Set<Deal>>();

  getDealsForRecords(records: (License | Transaction)[]) {
    return new Set(records
      .map(record => this.getByMpacId(record.id))
      .filter(isPresent));
  }

}

function isNonBlankString(str: string | null) {
  return (str ?? '').length > 0;
}

function isNonZeroNumberString(str: string | null) {
  return +(str ?? '') > 0;
}

function enumFromValue<T extends number>(mapping: Record<T, string>, apiValue: string): T {
  const found = Object.entries(mapping).find(([k, v]) => v === apiValue);
  if (!found) throw new AttachableError('Cannot find ENV-configured mapping:',
    JSON.stringify({ mapping, apiValue }, null, 2));
  return +found[0] as T;
}

const pipelines: Record<Pipeline, string> = {
  [Pipeline.MPAC]: env.hubspot.pipeline.mpac,
};

const dealstages: Record<DealStage, string> = {
  [DealStage.EVAL]: env.hubspot.dealstage.eval,
  [DealStage.CLOSED_WON]: env.hubspot.dealstage.closedWon,
  [DealStage.CLOSED_LOST]: env.hubspot.dealstage.closedLost,
};
