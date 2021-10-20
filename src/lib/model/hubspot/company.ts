import { EntityKind } from "../../io/hubspot.js";
import { Entity } from "./entity.js";
import { EntityManager, PropertyTransformers } from "./manager.js";

type CompanyProps = {
  name: string;
  type: 'Partner' | null;
};

export class Company extends Entity<CompanyProps> {
}

export class CompanyManager extends EntityManager<CompanyProps, Company> {

  override Entity = Company;
  override kind: EntityKind = 'company';

  override associations: EntityKind[] = [
  ];

  override apiProperties: string[] = [
    'name',
    'type',
  ];

  override fromAPI(data: { [key: string]: string | null }): CompanyProps | null {
    return {
      name: data.name ?? '',
      type: data.type === 'PARTNER' ? 'Partner' : null,
    };
  }

  override toAPI: PropertyTransformers<CompanyProps> = {
    name: name => ['name', name],
    type: type => ['type', type === 'Partner' ? 'PARTNER' : ''],
  };

  override identifiers: (keyof CompanyProps)[] = [
  ];

  override addIndexes(companies: Iterable<Company>) { }

}
