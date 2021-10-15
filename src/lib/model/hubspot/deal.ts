import { DealStage, Pipeline } from "../../config/dynamic-enums.js";
import { SimplePublicObject } from "@hubspot/api-client/lib/codegen/crm/companies/api";
import { HubspotEntity } from "./entity.js";
import { HubspotEntityKind, HubspotEntityManager } from "./manager.js";
import { Company } from "./company.js";
import { Contact } from "./contact.js";
import config from "../../config/index.js";

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

  companies: Company[] = [];
  contacts: Contact[] = [];

}

class DealManager extends HubspotEntityManager<DealProps, Deal, SimplePublicObject> {

  override kind: HubspotEntityKind = "deal";

  override associations: [keyof Deal, HubspotEntityKind][] = [
    ["companies", "company"],
    ["contacts", "contact"],
  ];

  override apiProperties: string[] = [
    'closedate',
    'deployment',
    config.hubspot.attrs.deal.addonLicenseId,
    config.hubspot.attrs.deal.transactionId,
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

  override fromAPI(data: SimplePublicObject['properties']): DealProps {
    return {
      relatedProducts: data.related_products,
      aaApp: data.aa_app,
      addonLicenseId: data[config.hubspot.attrs.deal.addonLicenseId],
      transactionId: data[config.hubspot.attrs.deal.transactionId],
      closeDate: data.closedate,
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

  override toAPI(props: DealProps) {
    return {
      related_products: props.relatedProducts,
      aa_app: props.aaApp,
      [config.hubspot.attrs.deal.addonLicenseId]: props.addonLicenseId || '',
      [config.hubspot.attrs.deal.transactionId]: props.transactionId || '',
      closedate: props.closeDate,
      country: props.country,
      dealname: props.dealName,
      origin: props.origin,
      deployment: props.deployment,
      license_tier: props.licenseTier.toFixed(),
      pipeline: props.pipeline,
      dealstage: props.dealstage,
      amount: props.amount?.toString() ?? '',
    };
  }

}
