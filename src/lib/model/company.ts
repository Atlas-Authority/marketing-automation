import { EntityKind } from "../io/hubspot.js";
import { Entity } from "./hubspot/entity.js";
import { EntityManager, PropertyTransformers } from "./hubspot/manager.js";

type CompanyData = {
  name: string;
  type: 'Partner' | null;
};

export class Company extends Entity<CompanyData> {
}

export class CompanyManager extends EntityManager<CompanyData, Company> {

  override Entity = Company;
  override kind: EntityKind = 'company';

  override associations: EntityKind[] = [
  ];

  override apiProperties: string[] = [
    'name',
    'type',
  ];

  override fromAPI(data: { [key: string]: string | null }): CompanyData | null {
    return {
      name: data.name ?? '',
      type: data.type === 'PARTNER' ? 'Partner' : null,
    };
  }

  override toAPI: PropertyTransformers<CompanyData> = {
    name: name => ['name', name],
    type: type => ['type', type === 'Partner' ? 'PARTNER' : ''],
  };

  override identifiers: (keyof CompanyData)[] = [
  ];

  override addIndexes(companies: Iterable<Company>, full: boolean) { }

}
