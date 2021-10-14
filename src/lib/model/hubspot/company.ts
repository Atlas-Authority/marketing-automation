import { SimplePublicObject } from "@hubspot/api-client/lib/codegen/crm/companies/api";
import { HubspotEntity } from "./entity.js";
import { HubspotEntityKind, HubspotEntityManager } from "./manager.js";

type CompanyProps = {
  name: string;
  type: 'Partner' | null;
};

export class Company extends HubspotEntity<CompanyProps> {
}

class CompanyManager extends HubspotEntityManager<CompanyProps, Company, SimplePublicObject> {

  override kind: HubspotEntityKind = 'company';

  override associations: [keyof Company, HubspotEntityKind][] = [];

  override apiProperties: string[] = [
    'name',
    'type',
  ];

  override fromAPI(data: SimplePublicObject['properties']): CompanyProps {
    return {
      name: data.name,
      type: data.type === 'PARTNER' ? 'Partner' : null,
    };
  }

  override toAPI(props: CompanyProps) {
    return {
      name: props.name,
      type: props.type === 'Partner' ? 'PARTNER' : '',
    };
  }

}
