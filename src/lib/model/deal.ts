import { DealStage, Pipeline } from "../config/dynamic-enums.js";
import config from "../config/index.js";
import { EntityKind } from "../io/hubspot.js";
import { isPresent } from "../util/helpers.js";
import { Company } from "./company.js";
import { Contact } from "./contact.js";
import { Entity } from "./hubspot/entity.js";
import { EntityManager, PropertyTransformers } from "./hubspot/manager.js";
import { License } from "./license.js";
import { Transaction } from "./transaction.js";

const addonLicenseIdKey = config.hubspot.attrs.deal.addonLicenseId;
const transactionIdKey = config.hubspot.attrs.deal.transactionId;
const deploymentKey = config.hubspot.attrs.deal.deployment;
const appKey = config.hubspot.attrs.deal.app;

export type DealData = {
  relatedProducts: string;
  app: string;
  addonLicenseId: string | null;
  transactionId: string | null;
  closeDate: string;
  country: string;
  dealName: string;
  origin: string;
  deployment: 'Server' | 'Cloud' | 'Data Center';
  licenseTier: number;
  pipeline: Pipeline;
  dealstage: DealStage;
  amount: number | null;
  readonly hasActivity: boolean;
};

export class Deal extends Entity<DealData> {

  contacts = this.makeDynamicAssociation<Contact>('contact');
  companies = this.makeDynamicAssociation<Company>('company');

  isEval() { return this.data.dealstage === DealStage.EVAL; }
  isClosed() {
    return (
      this.data.dealstage === DealStage.CLOSED_LOST ||
      this.data.dealstage === DealStage.CLOSED_WON
    );
  }

}

export class DealManager extends EntityManager<DealData, Deal> {

  override Entity = Deal;
  override kind: EntityKind = "deal";

  override associations: EntityKind[] = [
    "company",
    "contact",
  ];

  override apiProperties: string[] = [
    'closedate',
    deploymentKey,
    addonLicenseIdKey,
    transactionIdKey,
    appKey,
    'license_tier',
    'country',
    'origin',
    'related_products',
    'dealname',
    'dealstage',
    'pipeline',
    'amount',

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
    if (data.pipeline !== Pipeline.AtlassianMarketplace) return null;
    return {
      relatedProducts: data['related_products'] as string,
      app: data[appKey] as string,
      addonLicenseId: data[addonLicenseIdKey],
      transactionId: data[transactionIdKey],
      closeDate: (data['closedate'] as string).substr(0, 10),
      country: data['country'] as string,
      dealName: data['dealname'] as string,
      origin: data['origin'] as DealData['origin'],
      deployment: data[deploymentKey] as DealData['deployment'],
      licenseTier: +(data['license_tier'] as string),
      pipeline: data['pipeline'],
      dealstage: data['dealstage'] as string,
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
    relatedProducts: relatedProducts => ['related_products', relatedProducts],
    app: app => [appKey, app],
    addonLicenseId: addonLicenseId => [addonLicenseIdKey, addonLicenseId || ''],
    transactionId: transactionId => [transactionIdKey, transactionId || ''],
    closeDate: closeDate => ['closedate', closeDate],
    country: country => ['country', country],
    dealName: dealName => ['dealname', dealName],
    origin: origin => ['origin', origin],
    deployment: deployment => [deploymentKey, deployment],
    licenseTier: licenseTier => ['license_tier', licenseTier.toFixed()],
    pipeline: pipeline => ['pipeline', pipeline],
    dealstage: dealstage => ['dealstage', dealstage],
    amount: amount => ['amount', amount?.toString() ?? ''],
    hasActivity: EntityManager.downSyncOnly,
  };

  override identifiers: (keyof DealData)[] = [
    'addonLicenseId',
    'transactionId',
  ];

  private dealsByAddonLicenseId = this.makeIndex(d => [d.data.addonLicenseId].filter(isPresent));
  private dealsByTransactionId = this.makeIndex(d => [d.data.transactionId].filter(isPresent));

  getByAddonLicenseId(id: string) {
    return this.dealsByAddonLicenseId.get(id);
  }

  getByTransactionId(id: string) {
    return this.dealsByTransactionId.get(id);
  }

  getDealsForRecords(records: (License | Transaction)[]) {
    return new Set(records
      .map(record => this.getById(record))
      .filter(isPresent));
  }

  private getById(record: License | Transaction): Deal | undefined {
    return (record instanceof Transaction
      ? (
        this.dealsByTransactionId.get(record.data.transactionId) ||
        this.dealsByAddonLicenseId.get(record.data.addonLicenseId)
      )
      : this.dealsByAddonLicenseId.get(record.data.addonLicenseId));
  }

}

function isNonBlankString(str: string | null) {
  return (str ?? '').length > 0;
}

function isNonZeroNumberString(str: string | null) {
  return +(str ?? '') > 0;
}
