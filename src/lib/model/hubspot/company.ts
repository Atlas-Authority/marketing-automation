import { SimplePublicObject } from "@hubspot/api-client/lib/codegen/crm/companies/api";
import { HubspotEntity, HubspotEntityKind } from "./entity.js";
import { HubspotEntityManager, HubspotPropertyTransformers } from "./manager.js";

type CompanyProps = {
  name: string;
  type: 'Partner' | null;
};

export class Company extends HubspotEntity<CompanyProps> {
}

export class CompanyManager extends HubspotEntityManager<CompanyProps, Company, SimplePublicObject> {

  override Entity = Company;
  override kind: HubspotEntityKind = 'company';

  override associations: HubspotEntityKind[] = [
  ];

  override apiProperties: string[] = [
    'name',
    'type',
  ];

  override fromAPI(data: SimplePublicObject['properties']): CompanyProps | null {
    return {
      name: data.name,
      type: data.type === 'PARTNER' ? 'Partner' : null,
    };
  }

  override toAPI: HubspotPropertyTransformers<CompanyProps> = {
    name: name => ['name', name],
    type: type => ['type', type === 'Partner' ? 'PARTNER' : ''],
  };

  override identifiers: (keyof CompanyProps)[] = [
  ];

}
