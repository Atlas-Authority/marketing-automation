import { HubspotEntity, HubspotEntityKind } from "./entity.js";
import { HubspotEntityManager, HubspotPropertyTransformers } from "./manager.js";

type CompanyProps = {
  name: string;
  type: 'Partner' | null;
};

export class Company extends HubspotEntity<CompanyProps> {
}

export class CompanyManager extends HubspotEntityManager<CompanyProps, Company> {

  override Entity = Company;
  override kind: HubspotEntityKind = 'company';

  override associations: HubspotEntityKind[] = [
  ];

  override apiProperties: string[] = [
    'name',
    'type',
  ];

  override fromAPI(data: { [key: string]: string }): CompanyProps | null {
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
