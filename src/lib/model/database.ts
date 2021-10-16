import { DealManager } from "./hubspot/deal.js";
import * as hubspot from '@hubspot/api-client';
import { ContactManager } from "./hubspot/contact.js";
import { CompanyManager } from "./hubspot/company.js";
import * as assert from 'assert';
import { HubspotEntityKind } from "./hubspot/entity.js";

class Database {

  dealManager: DealManager;
  contactManager: ContactManager;
  companyManager: CompanyManager;

  constructor(private client: hubspot.Client) {
    this.dealManager = new DealManager(this.client);
    this.contactManager = new ContactManager(this.client);
    this.companyManager = new CompanyManager(this.client);
  }

  async downloadAllEntities() {
    const [
      dealAssociations,
      contactAssociations,
      companyAssociations,
    ] = await Promise.all([
      this.dealManager.downloadAllEntities(),
      this.contactManager.downloadAllEntities(),
      this.companyManager.downloadAllEntities(),
    ]);

    const getManager = (kind: HubspotEntityKind) => {
      switch (kind) {
        case 'deal': return this.dealManager;
        case 'company': return this.companyManager;
        case 'contact': return this.contactManager;
      }
    };

    const allAssociations = [...dealAssociations, ...contactAssociations, ...companyAssociations];
    for (const [otherKind, otherId, associate] of allAssociations) {
      const manager = getManager(otherKind);
      const otherEntity = manager.get(otherId);
      assert.ok(otherEntity);
      associate(otherEntity);
    }
  }

}
