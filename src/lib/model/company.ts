import { Contact } from "./contact.js";
import { Entity } from "./hubspot/entity.js";
import { EntityKind } from "./hubspot/interfaces.js";
import { EntityManager, PropertyTransformers } from "./hubspot/manager.js";

type CompanyData = {
  name: string;
  type: 'Partner' | null;
};

export class Company extends Entity<CompanyData> {

  static kind: EntityKind = 'company';

  contacts = this.makeDynamicAssociation<Contact>('contact');

  override pseudoProperties: (keyof CompanyData)[] = [];

}

export class CompanyManager extends EntityManager<CompanyData, Company> {

  override Entity = Company;

  override downAssociations: EntityKind[] = [
    'contact'
  ];

  override upAssociations: EntityKind[] = [];

  override apiProperties: string[] = [
    'name',
    'type',
  ];

  override fromAPI(data: { [key: string]: string | null }): CompanyData | null {
    return {
      name: data['name'] ?? '',
      type: data['type'] === 'PARTNER' ? 'Partner' : null,
    };
  }

  override toAPI: PropertyTransformers<CompanyData> = {
    name: name => ['name', name],
    type: type => ['type', type === 'Partner' ? 'PARTNER' : ''],
  };

  override identifiers: (keyof CompanyData)[] = [
  ];

}
