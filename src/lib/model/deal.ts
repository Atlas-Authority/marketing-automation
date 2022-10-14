import { hubspotAccountIdFromEnv } from "../config/env";
import { Entity } from "../hubspot/entity";
import { DealStage, EntityAdapter, Pipeline } from "../hubspot/interfaces";
import { EntityManager } from "../hubspot/manager";
import { AttachableError } from "../util/errors";
import { isPresent } from "../util/helpers";
import { Company } from "./company";
import { Contact } from "./contact";
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
  saleType: 'New' | 'Renewal' | 'Upgrade' | null;
  licenseTier: number | null;
  pipeline: Pipeline;
  dealStage: DealStage;
  amount: number | null;
  associatedPartner: string | null;

  appEntitlementId: string | null;
  appEntitlementNumber: string | null;

  duplicateOf: string | null;
  maintenanceEndDate: string | null;
};

export class Deal extends Entity<DealData> {

  public contacts = this.makeDynamicAssociation<Contact>('contact');
  public companies = this.makeDynamicAssociation<Company>('company');

  public getMpacIds() {
    return new Set([
      this.deriveId(this.data.addonLicenseId),
      this.deriveId(this.data.appEntitlementId),
      this.deriveId(this.data.appEntitlementNumber),
    ].filter(isPresent));
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
    const hsAccountId = hubspotAccountIdFromEnv;
    return (hsAccountId
      ? `https://app.hubspot.com/contacts/${hsAccountId}/deal/${this.id}/`
      : `Deal=${this.id} (see link by setting HUBSPOT_ACCOUNT_ID)`);
  }

  hasActivity() {
    return (
      isNonBlankString(this.downloadedData['hs_user_ids_of_all_owners']) ||
      isNonBlankString(this.downloadedData['engagements_last_meeting_booked']) ||
      isNonBlankString(this.downloadedData['hs_latest_meeting_activity']) ||
      isNonBlankString(this.downloadedData['notes_last_contacted']) ||
      isNonBlankString(this.downloadedData['notes_last_updated']) ||
      isNonBlankString(this.downloadedData['notes_next_activity_date']) ||
      isNonBlankString(this.downloadedData['hs_sales_email_last_replied']) ||
      isNonZeroNumberString(this.downloadedData['num_contacted_notes']) ||
      isNonZeroNumberString(this.downloadedData['num_notes'])
    );
  }

}

export interface HubspotDealConfig {
  accountId?: string,
  pipeline?: {
    mpac?: string,
  },
  dealstage?: {
    eval?: string,
    closedWon?: string,
    closedLost?: string,
  },
  attrs?: {
    appEntitlementId?: string,
    appEntitlementNumber?: string,
    addonLicenseId?: string,
    transactionId?: string,
    app?: string,
    origin?: string,
    country?: string,
    deployment?: string,
    saleType?: string,
    licenseTier?: string,
    relatedProducts?: string,
    associatedPartner?: string,
    duplicateOf?: string,
    maintenanceEndDate?: string;
  },
  managedFields?: Set<string>,
}

export interface HubspotRequiredDealConfig {
  pipeline: {
    mpac: string,
  },
  dealstage: {
    eval: string,
    closedWon: string,
    closedLost: string,
  },
  attrs: {
    appEntitlementId: string,
    appEntitlementNumber: string,
    addonLicenseId: string,
    transactionId: string,
  },
}

function isNonBlankString(str: string | null) {
  return (str ?? '').length > 0;
}

function isNonZeroNumberString(str: string | null) {
  return +(str ?? '') > 0;
}

function makeAdapter(config: HubspotDealConfig): EntityAdapter<DealData> {
  const requiredConfig: HubspotRequiredDealConfig = {
    pipeline: {
      mpac: config.pipeline?.mpac ?? 'Pipeline',
    },
    dealstage: {
      eval: config.dealstage?.eval ?? 'Eval',
      closedWon: config.dealstage?.closedWon ?? 'ClosedWon',
      closedLost: config.dealstage?.closedLost ?? 'ClosedLost',
    },
    attrs: {
      appEntitlementId: config.attrs?.appEntitlementId ?? 'appEntitlementId',
      appEntitlementNumber: config.attrs?.appEntitlementNumber ?? 'appEntitlementNumber',
      addonLicenseId: config.attrs?.addonLicenseId ?? 'addonLicenseId',
      transactionId: config.attrs?.transactionId ?? 'transactionId',
    },
  };

  function enumFromValue<T extends number>(mapping: Record<T, string>, apiValue: string): T {
    const found = Object.entries(mapping).find(([k, v]) => v === apiValue);
    if (!found) throw new AttachableError('Cannot find ENV-configured mapping:',
      JSON.stringify({ mapping, apiValue }, null, 2));
    return +found[0] as T;
  }

  const pipelines: Record<Pipeline, string> = {
    [Pipeline.MPAC]: requiredConfig.pipeline.mpac,
  };

  const dealstages: Record<DealStage, string> = {
    [DealStage.EVAL]: requiredConfig.dealstage.eval,
    [DealStage.CLOSED_WON]: requiredConfig.dealstage.closedWon,
    [DealStage.CLOSED_LOST]: requiredConfig.dealstage.closedLost,
  };

  return {

    kind: 'deal',

    associations: {
      company: 'down/up',
      contact: 'down/up',
    },

    shouldReject(data) {
      if (data['pipeline'] !== requiredConfig.pipeline.mpac) return true;
      if (config.attrs?.duplicateOf && data[config.attrs?.duplicateOf]) return true;
      return false;
    },

    data: {
      relatedProducts: {
        property: config.attrs?.relatedProducts,
        down: related_products => related_products || null,
        up: relatedProducts => relatedProducts ?? '',
      },
      app: {
        property: config.attrs?.app,
        down: app => app,
        up: app => app ?? '',
      },
      addonLicenseId: {
        property: requiredConfig.attrs.addonLicenseId,
        identifier: true,
        down: id => id || null,
        up: id => id || '',
      },
      transactionId: {
        property: requiredConfig.attrs.transactionId,
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
        property: config.attrs?.country,
        down: country => country,
        up: country => country ?? '',
      },
      dealName: {
        property: 'dealname',
        down: dealname => dealname!,
        up: dealName => dealName,
      },
      origin: {
        property: config.attrs?.origin,
        down: origin => origin,
        up: origin => origin ?? '',
      },
      deployment: {
        property: config.attrs?.deployment,
        down: deployment => deployment as DealData['deployment'],
        up: deployment => deployment ?? '',
      },
      saleType: {
        property: config.attrs?.saleType,
        down: sale_type => sale_type as DealData['saleType'],
        up: saleType => saleType ?? '',
      },
      licenseTier: {
        property: config.attrs?.licenseTier,
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
        property: config.attrs?.associatedPartner,
        down: partner => partner || null,
        up: partner => partner ?? '',
      },
      appEntitlementId: {
        property: requiredConfig.attrs.appEntitlementId,
        identifier: true,
        down: id => id || null,
        up: id => id ?? '',
      },
      appEntitlementNumber: {
        property: requiredConfig.attrs.appEntitlementNumber,
        identifier: true,
        down: id => id || null,
        up: id => id ?? '',
      },
      duplicateOf: {
        property: config.attrs?.duplicateOf,
        down: id => id || null,
        up: id => id ?? '',
      },
      maintenanceEndDate: {
        property: config.attrs?.maintenanceEndDate,
        down: maintenanceEnd => maintenanceEnd ? maintenanceEnd.substr(0, 10) : null,
        up: maintenanceEnd => maintenanceEnd ?? '',
      },
    },

    additionalProperties: [
      'hs_user_ids_of_all_owners',
      'engagements_last_meeting_booked',
      'hs_latest_meeting_activity',
      'notes_last_contacted',
      'notes_last_updated',
      'notes_next_activity_date',
      'num_contacted_notes',
      'num_notes',
      'hs_sales_email_last_replied',
      'createdate',
    ],

    managedFields: config.managedFields ?? new Set(),

  };

}

export class DealManager extends EntityManager<DealData, Deal> {

  protected override Entity = Deal;
  public override entityAdapter: EntityAdapter<DealData>;

  public duplicates = new Map<Deal, Deal[]>();

  constructor(typeMappings: Map<string, string>, config: HubspotDealConfig) {
    super(typeMappings);
    this.entityAdapter = makeAdapter(config);
  }

}
