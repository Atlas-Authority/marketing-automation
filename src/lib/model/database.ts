import { DealManager } from "./hubspot/deal.js";
import * as hubspot from '@hubspot/api-client';
import * as assert from 'assert';
import { ContactManager } from "./hubspot/contact.js";
import { CompanyManager } from "./hubspot/company.js";
import { HubspotEntity } from "./hubspot/entity.js";
import { HubspotEntityKind } from "../io/hubspot.js";

export class Database {

  dealManager: DealManager;
  contactManager: ContactManager;
  companyManager: CompanyManager;

  constructor(private client: hubspot.Client) {
    this.dealManager = new DealManager(this.client, this);
    this.contactManager = new ContactManager(this.client, this);
    this.companyManager = new CompanyManager(this.client, this);
  }

  async downloadAllEntities() {
    await Promise.all([
      this.dealManager.downloadAllEntities(),
      this.contactManager.downloadAllEntities(),
      this.companyManager.downloadAllEntities(),
    ]);
  }

  getEntity(kind: HubspotEntityKind, id: string): HubspotEntity<any> {
    const found = this.getManager(kind).get(id);
    // There's only two ways to set associations:
    // 1. They were already set in HubSpot when we downloaded them, or
    // 2. We set them in code with an object already having a valid id.
    // In either case, an invalid id would fail before this method.
    assert.ok(found);
    return found;
  }

  private getManager(kind: HubspotEntityKind) {
    switch (kind) {
      case 'deal': return this.dealManager;
      case 'company': return this.companyManager;
      case 'contact': return this.contactManager;
    }
  }

}
