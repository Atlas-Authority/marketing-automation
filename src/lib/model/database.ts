import { DealManager } from "./hubspot/deal.js";
import * as assert from 'assert';
import { ContactManager } from "./hubspot/contact.js";
import { CompanyManager } from "./hubspot/company.js";
import { HubspotEntity } from "./hubspot/entity.js";
import { EntityKind } from "../io/hubspot.js";
import { Downloader } from "../io/downloader/downloader.js";
import { Uploader } from "../io/uploader/uploader.js";

export class Database {

  dealManager: DealManager;
  contactManager: ContactManager;
  companyManager: CompanyManager;

  constructor(downloader: Downloader, uploader: Uploader) {
    this.dealManager = new DealManager(downloader, uploader, this);
    this.contactManager = new ContactManager(downloader, uploader, this);
    this.companyManager = new CompanyManager(downloader, uploader, this);
  }

  async downloadAllEntities() {
    await Promise.all([
      this.dealManager.downloadAllEntities(),
      this.contactManager.downloadAllEntities(),
      this.companyManager.downloadAllEntities(),
    ]);
  }

  getEntity(kind: EntityKind, id: string): HubspotEntity<any> {
    const found = this.getManager(kind).get(id);
    // There's only two ways to set associations:
    // 1. They were already set in HubSpot when we downloaded them, or
    // 2. We set them in code with an object already having a valid id.
    // In either case, an invalid id would fail before this method.
    assert.ok(found);
    return found;
  }

  private getManager(kind: EntityKind) {
    switch (kind) {
      case 'deal': return this.dealManager;
      case 'company': return this.companyManager;
      case 'contact': return this.contactManager;
    }
  }

}
