import { DealStage, Pipeline } from "../../config/dynamic-enums.js";
import { HubspotEntity, HubspotEntityKind } from "./entity.js";
import { HubspotEntityManager, HubspotPropertyTransformers } from "./manager.js";
import config from "../../config/index.js";
import { Contact } from "./contact.js";
import { Company } from "./company.js";

const addonLicenseIdKey = config.hubspot.attrs.deal.addonLicenseId;
const transactionIdKey = config.hubspot.attrs.deal.transactionId;

type DealProps = {
  relatedProducts: string;
  aaApp: string;
  addonLicenseId: string | null;
  transactionId: string | null;
  closeDate: string;
  country: string;
  dealName: string;
  origin: 'MPAC Lead';
  deployment: 'Server' | 'Cloud' | 'Data Center';
  licenseTier: number;
  pipeline: Pipeline;
  dealstage: DealStage;
  amount: number | null;
};

export class Deal extends HubspotEntity<DealProps> {

  contacts = this.makeDynamicAssociation<Contact>('contact');
  companies = this.makeDynamicAssociation<Company>('company');

}

export class DealManager extends HubspotEntityManager<DealProps, Deal> {

  override Entity = Deal;
  override kind: HubspotEntityKind = "deal";

  override associations: HubspotEntityKind[] = [
    "company",
    "contact",
  ];

  override apiProperties: string[] = [
    'closedate',
    'deployment',
    addonLicenseIdKey,
    transactionIdKey,
    'aa_app',
    'license_tier',
    'country',
    'origin',
    'related_products',
    'dealname',
    'dealstage',
    'pipeline',
    'amount',
  ];

  override fromAPI(data: { [key: string]: string }): DealProps | null {
    if (data.pipeline !== Pipeline.AtlassianMarketplace) return null;
    return {
      relatedProducts: data.related_products,
      aaApp: data.aa_app,
      addonLicenseId: data[addonLicenseIdKey],
      transactionId: data[transactionIdKey],
      closeDate: data.closedate.substr(0, 10),
      country: data.country,
      dealName: data.dealname,
      origin: data.origin as DealProps['origin'],
      deployment: data.deployment as DealProps['deployment'],
      licenseTier: +data.license_tier,
      pipeline: data.pipeline,
      dealstage: data.dealstage,
      amount: data.amount === '' ? null : +data.amount,
    };
  }

  override toAPI: HubspotPropertyTransformers<DealProps> = {
    relatedProducts: relatedProducts => ['related_products', relatedProducts],
    aaApp: aaApp => ['aa_app', aaApp],
    addonLicenseId: addonLicenseId => [addonLicenseIdKey, addonLicenseId || ''],
    transactionId: transactionId => [transactionIdKey, transactionId || ''],
    closeDate: closeDate => ['closedate', closeDate],
    country: country => ['country', country],
    dealName: dealName => ['dealname', dealName],
    origin: origin => ['origin', origin],
    deployment: deployment => ['deployment', deployment],
    licenseTier: licenseTier => ['license_tier', licenseTier.toFixed()],
    pipeline: pipeline => ['pipeline', pipeline],
    dealstage: dealstage => ['dealstage', dealstage],
    amount: amount => ['amount', amount?.toString() ?? ''],
  };

  override identifiers: (keyof DealProps)[] = [
    'addonLicenseId',
    'transactionId',
  ];

}
