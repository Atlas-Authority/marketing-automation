import env from "../parameters/env-config";
import { AttachableError } from "../util/errors";
import { isPresent } from "../util/helpers";
import { Company } from "./company";
import { Contact } from "./contact";
import { Entity } from "./hubspot/entity";
import { DealStage, EntityKind, Pipeline } from "./hubspot/interfaces";
import { EntityAdapter, EntityManager } from "./hubspot/manager";
import { uniqueTransactionId } from "./transaction";

export type DealData = {
  relatedProducts: string | null;
  app: string | null;
  addonLicenseId: string | null;
  transactionId: string | null;
  closeDate: string;
  country: string | null;
  dealName: string;
  origin: string | null;
  deployment: 'Server' | 'Cloud' | 'Data Center' | null;
  licenseTier: number | null;
  pipeline: Pipeline;
  dealStage: DealStage;
  amount: number | null;
  associatedPartner: string | null;

  appEntitlementId: string | null;
  appEntitlementNumber: string | null;
};

type DealComputed = {
  readonly hasActivity: boolean;
  readonly createdDate: string;
};

export class Deal extends Entity<DealData, DealComputed> {

  public contacts = this.makeDynamicAssociation<Contact>('contact');
  public companies = this.makeDynamicAssociation<Company>('company');

  public getMpacIds() {
    return [
      this.deriveId(this.data.addonLicenseId),
      this.deriveId(this.data.appEntitlementId),
      this.deriveId(this.data.appEntitlementNumber),
    ].filter(isPresent);
  }

  private deriveId(id: string | null) {
    if (!id) return null;
    if (!this.data.transactionId) return id;
    return uniqueTransactionId(this.data.transactionId, id);
  }

  public get isWon() { return this.data.dealStage === DealStage.CLOSED_WON }
  public get isLost() { return this.data.dealStage === DealStage.CLOSED_LOST }

  public isEval() { return this.data.dealStage === DealStage.EVAL; }
  public isClosed() { return this.isWon || this.isLost; }

  public link() {
    const hsAccountId = env.hubspot.accountId;
    return (hsAccountId
      ? `https://app.hubspot.com/contacts/${hsAccountId}/deal/${this.id}/`
      : `Deal=${this.id} (see link by setting HUBSPOT_ACCOUNT_ID)`);
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
    relatedProducts: {
      property: env.hubspot.attrs.deal.relatedProducts,
      down: related_products => related_products || null,
      up: relatedProducts => relatedProducts ?? '',
    },
    app: {
      property: env.hubspot.attrs.deal.app,
      down: app => app,
      up: app => app ?? '',
    },
    addonLicenseId: {
      property: env.hubspot.attrs.deal.addonLicenseId,
      identifier: true,
      down: id => id || null,
      up: id => id || '',
    },
    transactionId: {
      property: env.hubspot.attrs.deal.transactionId,
      identifier: true,
      down: id => id || null,
      up: id => id || '',
    },
    closeDate: {
      property: 'closedate',
      down: closedate => closedate!.substr(0, 10),
      up: closeDate => closeDate,
    },
    country: {
      property: env.hubspot.attrs.deal.country,
      down: country => country,
      up: country => country ?? '',
    },
    dealName: {
      property: 'dealname',
      down: dealname => dealname!,
      up: dealName => dealName,
    },
    origin: {
      property: env.hubspot.attrs.deal.origin,
      down: origin => origin,
      up: origin => origin ?? '',
    },
    deployment: {
      property: env.hubspot.attrs.deal.deployment,
      down: deployment => deployment as DealData['deployment'],
      up: deployment => deployment ?? '',
    },
    licenseTier: {
      property: env.hubspot.attrs.deal.licenseTier,
      down: license_tier => license_tier ? +license_tier : null,
      up: licenseTier => licenseTier?.toFixed() ?? '',
    },
    pipeline: {
      property: 'pipeline',
      down: data => Pipeline.MPAC,
      up: pipeline => pipelines[pipeline],
    },
    dealStage: {
      property: 'dealstage',
      down: dealstage => enumFromValue(dealstages, dealstage ?? ''),
      up: dealstage => dealstages[dealstage],
    },
    amount: {
      property: 'amount',
      down: amount => !amount ? null : +amount,
      up: amount => amount?.toString() ?? '',
    },
    associatedPartner: {
      property: env.hubspot.attrs.deal.associatedPartner,
      down: partner => partner || null,
      up: partner => partner ?? '',
    },
    appEntitlementId: {
      property: env.hubspot.attrs.deal.appEntitlementId,
      identifier: true,
      down: id => id || null,
      up: id => id ?? '',
    },
    appEntitlementNumber: {
      property: env.hubspot.attrs.deal.appEntitlementNumber,
      identifier: true,
      down: id => id || null,
      up: id => id ?? '',
    },
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
    createdDate: {
      default: '',
      down: data => data['createdate']!,
      properties: ['createdate'],
    }
  },

};

export class DealManager extends EntityManager<DealData, DealComputed, Deal> {

  protected override Entity = Deal;
  protected override kind: EntityKind = 'deal';
  protected override entityAdapter = DealAdapter;

  public duplicates = new Map<Deal, Deal[]>();

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
