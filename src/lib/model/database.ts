import { DealManager } from "./hubspot/deal.js";
import * as hubspot from '@hubspot/api-client';
import { ContactManager } from "./hubspot/contact.js";
import { CompanyManager } from "./hubspot/company.js";

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
      dealAssocations,
      contactAssocations,
      companyAssocations,
    ] = await Promise.all([
      this.dealManager.downloadAllEntities(),
      this.contactManager.downloadAllEntities(),
      this.companyManager.downloadAllEntities(),
    ]);


  }

}
