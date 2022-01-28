import { hubspotContactConfigFromENV, hubspotDealConfigFromENV } from "../config/env";
import { CompanyManager } from "../model/company";
import { ContactManager, HubspotContactConfig } from "../model/contact";
import { DealManager, HubspotDealConfig } from "../model/deal";
import { Entity } from "./entity";

export class Hubspot {

  public static withConfigFromENV() {
    return new Hubspot({
      contact: hubspotContactConfigFromENV(),
      deal: hubspotDealConfigFromENV(),
    });
  }

  public dealManager;
  public contactManager;
  public companyManager;

  public constructor(config?: { deal?: HubspotDealConfig, contact?: HubspotContactConfig }) {
    this.dealManager = new DealManager(config?.deal ?? {});
    this.contactManager = new ContactManager(config?.contact ?? {});
    this.companyManager = new CompanyManager();
  }

  public populateFakeIds() {
    fillInIds(this.dealManager.getAll());
    fillInIds(this.contactManager.getAll());
    fillInIds(this.companyManager.getAll());

    function fillInIds(entities: Iterable<Entity<any>>) {
      let id = 0;
      for (const e of entities) {
        if (!e.id) e.id = `fake-${e.kind}-${++id}`;
      }
    }
  }

}
