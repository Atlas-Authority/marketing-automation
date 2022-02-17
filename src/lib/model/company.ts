import { Entity } from "../hubspot/entity";
import { EntityAdapter } from "../hubspot/interfaces";
import { EntityManager } from "../hubspot/manager";
import { Contact } from "./contact";

type CompanyData = {
  name: string;
  type: 'Partner' | null;
};

export class Company extends Entity<CompanyData> {

  public contacts = this.makeDynamicAssociation<Contact>('contact');

}

export const CompanyAdapter: EntityAdapter<CompanyData> = {

  kind: 'company',

  associations: {
    contact: 'down',
  },

  data: {
    name: {
      property: 'name',
      down: name => name ?? '',
      up: name => name,
    },
    type: {
      property: 'type',
      down: type => type === 'PARTNER' ? 'Partner' : null,
      up: type => type === 'Partner' ? 'PARTNER' : '',
    },
  },

  additionalProperties: [],

  managedFields: new Set(),

};

export class CompanyManager extends EntityManager<CompanyData, Company> {

  protected override Entity = Company;
  public override entityAdapter = CompanyAdapter;

}
