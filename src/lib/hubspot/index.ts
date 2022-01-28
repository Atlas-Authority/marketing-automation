import { hubspotContactConfigFromENV, hubspotDealConfigFromENV } from "../config/env";
import { Data } from "../data/set";
import { CompanyManager } from "../model/company";
import { ContactManager, HubspotContactConfig } from "../model/contact";
import { DealManager, HubspotDealConfig } from "../model/deal";
import { Entity } from "./entity";

export class Hubspot {

  public static fromENV() {
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

  public importData(data: Data) {
    const dealPrelinks = this.dealManager.importEntities(data.rawDeals);
    const companyPrelinks = this.companyManager.importEntities(data.rawCompanies);
    const contactPrelinks = this.contactManager.importEntities(data.rawContacts);

    this.dealManager.linkEntities(dealPrelinks, this);
    this.companyManager.linkEntities(companyPrelinks, this);
    this.contactManager.linkEntities(contactPrelinks, this);
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
