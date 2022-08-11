import * as assert from 'assert';
import { getContactInfo, getPartnerInfo, maybeGetContactInfo, RawLicense } from "../marketplace/raw";
import { ContactInfo, MpacRecord, PartnerInfo } from './record.js';
import { Transaction } from './transaction';

type AttributionData = {
  channel: string;
  referrerDomain?: string;
  campaignName?: string;
  campaignSource?: string;
  campaignMedium?: string;
  campaignContent?: string;
};

type ParentProductInfo = {
  parentProductBillingCycle: 'NA' | 'Pending' | 'ANNUAL' | 'MONTHLY';
  parentProductName: 'NA' | 'Pending' | 'Confluence' | 'Jira';
  installedOnSandbox: 'NA' | 'Pending' | 'No' | 'Yes';
  parentProductEdition: 'NA' | 'Pending' | 'Free' | 'Standard' | 'Premium' | 'Enterprise';
};

type NewEvalData = {
  evaluationLicense: string;
  daysToConvertEval: number;
  evaluationStartDate: string;
  evaluationEndDate: string;
  evaluationSaleDate: string;
};

export interface LicenseData {
  addonLicenseId: string | null,
  appEntitlementId: string | null,
  appEntitlementNumber: string | null,

  licenseId: string | null,
  addonKey: string,
  addonName: string,
  lastUpdated: string,

  technicalContact: ContactInfo,
  billingContact: ContactInfo | null,
  partnerDetails: PartnerInfo | null,

  company: string,
  country: string,
  region: string,

  tier: string,
  licenseType: 'COMMERCIAL' | 'ACADEMIC' | 'COMMUNITY' | 'EVALUATION' | 'OPEN_SOURCE' | 'DEMONSTRATION' | 'INTERNAL USE',
  hosting: 'Server' | 'Cloud' | 'Data Center',
  maintenanceStartDate: string,
  maintenanceEndDate: string,

  status: 'inactive' | 'active' | 'cancelled',

  evaluationOpportunitySize: string,
  attribution: AttributionData | null,
  parentInfo: ParentProductInfo | null,
  newEvalData: NewEvalData | null,
}

export class License extends MpacRecord<LicenseData> {

  /** Unique ID for this License. */
  declare id;
  public ids = new Set<string>();

  declare tier;

  public transactions: Transaction[] = [];
  public active: boolean;

  static fromRaw(rawLicense: RawLicense) {
    let newEvalData: NewEvalData | null = null;
    if (rawLicense.evaluationLicense) {
      newEvalData = {
        evaluationLicense: rawLicense.evaluationLicense,
        daysToConvertEval: +rawLicense.daysToConvertEval!,
        evaluationStartDate: rawLicense.evaluationStartDate as string,
        evaluationEndDate: rawLicense.evaluationEndDate as string,
        evaluationSaleDate: rawLicense.evaluationSaleDate as string,
      };
    }

    let parentInfo: ParentProductInfo | null = null;
    if (rawLicense.parentProductBillingCycle
      || rawLicense.parentProductName
      || rawLicense.installedOnSandbox
      || rawLicense.parentProductEdition) {
      parentInfo = {
        parentProductBillingCycle: rawLicense.parentProductBillingCycle,
        parentProductName: rawLicense.parentProductName,
        installedOnSandbox: rawLicense.installedOnSandbox,
        parentProductEdition: rawLicense.parentProductEdition,
      } as ParentProductInfo;
    }

    return new License({
      addonLicenseId: rawLicense.addonLicenseId ?? null,
      appEntitlementId: rawLicense.appEntitlementId ?? null,
      appEntitlementNumber: rawLicense.appEntitlementNumber ?? null,

      licenseId: rawLicense.licenseId ?? null,
      addonKey: rawLicense.addonKey,
      addonName: rawLicense.addonName,
      lastUpdated: rawLicense.lastUpdated,

      technicalContact: getContactInfo(rawLicense.contactDetails.technicalContact),
      billingContact: maybeGetContactInfo(rawLicense.contactDetails.billingContact),
      partnerDetails: getPartnerInfo(rawLicense.partnerDetails),

      company: rawLicense.contactDetails.company,
      country: rawLicense.contactDetails.country,
      region: rawLicense.contactDetails.region,

      tier: rawLicense.tier,
      licenseType: rawLicense.licenseType,
      hosting: rawLicense.hosting,
      maintenanceStartDate: rawLicense.maintenanceStartDate,
      maintenanceEndDate: rawLicense.maintenanceEndDate,

      status: rawLicense.status,
      evaluationOpportunitySize: rawLicense.evaluationOpportunitySize ?? '',
      attribution: rawLicense.attribution ?? null,
      parentInfo,
      newEvalData,
    });
  }

  evaluatedFrom: License | undefined = undefined;
  evaluatedTo: License | undefined = undefined;

  public constructor(data: LicenseData) {
    super(data);

    const maybeAdd = (prefix: string, id: string | null) => {
      if (id) this.ids.add(`${prefix}-${id}`);
    };

    maybeAdd('ALI', this.data.addonLicenseId);
    maybeAdd('AEI', this.data.appEntitlementId);
    maybeAdd('AEN', this.data.appEntitlementNumber);

    this.id = [...this.ids][0];

    this.tier = Math.max(this.parseTier(), this.tierFromEvalOpportunity());
    this.active = this.data.status === 'active';
  }

  private parseTier() {
    const tier = this.data.tier;
    switch (tier) {
      case 'Unlimited Users':
        return 10001;
      case 'Subscription': // it'll be in evaluationOpportunitySize instead
      case 'Evaluation':
      case 'Demonstration License':
        return -1;
    }

    const m = tier.match(/^(\d+) Users$/);
    assert.ok(m, `Unknown license tier: ${tier}`);

    return + m[1];
  }

  private tierFromEvalOpportunity() {
    const size = this.data.evaluationOpportunitySize;
    switch (size) {
      case 'Unlimited Users':
        return 10001;
      case 'Unknown':
      case 'Evaluation':
      case 'NA':
      case '':
      case null:
      case undefined:
        return -1;
      default:
        return +size;
    }
  }

}
