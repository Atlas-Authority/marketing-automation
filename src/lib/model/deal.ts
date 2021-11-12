import env from "../parameters/env.js";
import { AttachableError } from "../util/errors.js";
import { isPresent } from "../util/helpers.js";
import { Company } from "./company.js";
import { Contact } from "./contact.js";
import { Entity } from "./hubspot/entity.js";
import { DealStage, EntityKind, Pipeline } from "./hubspot/interfaces.js";
import { EntityManager, PropertyTransformers } from "./hubspot/manager.js";
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
  readonly hasActivity: boolean;
};

export class Deal extends Entity<DealData> {

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

  isEval() { return this.data.dealStage === DealStage.EVAL; }
  isClosed() {
    return (
      this.data.dealStage === DealStage.CLOSED_LOST ||
      this.data.dealStage === DealStage.CLOSED_WON
    );
  }

  public link() {
    const hsAccountId = env.hubspot.accountId;
    return (hsAccountId
      ? `https://app.hubspot.com/contacts/${hsAccountId}/deal/${this.id}/`
      : `deal-id=${this.id}`);
  }

  override pseudoProperties: (keyof DealData)[] = [
    'hasActivity',
  ];

}

export class DealManager extends EntityManager<DealData, Deal> {

  override Entity = Deal;
  override kind: EntityKind = "deal";

  override downAssociations: EntityKind[] = [
    "company",
    "contact",
  ];

  override upAssociations: EntityKind[] = [
    "company",
    "contact",
  ];

  override apiProperties: string[] = [
    // Required
    'closedate',
    'license_tier',
    'country',
    'origin',
    'related_products',
    'dealname',
    'dealstage',
    'pipeline',
    'amount',

    // User-configurable
    addonLicenseIdKey,
    transactionIdKey,
    ...[
      deploymentKey,
      appKey,
    ].filter(isPresent),

    // For checking activity in duplicates
    'hs_user_ids_of_all_owners',
    'engagements_last_meeting_booked',
    'hs_latest_meeting_activity',
    'notes_last_contacted',
    'notes_last_updated',
    'notes_next_activity_date',
    'num_contacted_notes',
    'num_notes',
    'hs_sales_email_last_replied',
  ];

  override fromAPI(data: { [key: string]: string | null }): DealData | null {
    if (data['pipeline'] !== env.hubspot.pipeline.mpac) return null;
    return {
      relatedProducts: data['related_products'] || null,
      app: appKey ? data[appKey] as string : null,
      addonLicenseId: data[addonLicenseIdKey] as string,
      transactionId: data[transactionIdKey],
      closeDate: (data['closedate'] as string).substr(0, 10),
      country: data['country'] as string,
      dealName: data['dealname'] as string,
      origin: data['origin'] || null,
      deployment: deploymentKey ? data[deploymentKey] as DealData['deployment'] : null,
      licenseTier: +(data['license_tier'] as string),
      pipeline: enumFromValue(pipelines, data['pipeline']),
      dealStage: enumFromValue(dealstages, data['dealstage'] ?? ''),
      amount: !data['amount'] ? null : +data['amount'],
      hasActivity: (
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
    };
  }

  override toAPI: PropertyTransformers<DealData> = {
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
    hasActivity: EntityManager.noUpSync,
  };

  override identifiers: (keyof DealData)[] = [
    'addonLicenseId',
    'transactionId',
  ];

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
