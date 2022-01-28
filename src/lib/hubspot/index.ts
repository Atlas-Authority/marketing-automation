import { hubspotContactConfigFromENV, hubspotDealConfigFromENV } from "../config/env";
import { CompanyManager } from "../model/company";
import { ContactManager, HubspotContactConfig } from "../model/contact";
import { DealManager, HubspotDealConfig } from "../model/deal";
import { Entity } from "./entity";

export class Hubspot {

  public static live() {
    return new Hubspot(
      new DealManager(hubspotDealConfigFromENV()),
      new ContactManager(hubspotContactConfigFromENV()),
      new CompanyManager(),
    );
  }

  public static memoryFromENV() {
    return this.memory({
      contact: hubspotContactConfigFromENV(),
      deal: hubspotDealConfigFromENV(),
    });
  }

  public static memory(config?: { deal?: HubspotDealConfig, contact?: HubspotContactConfig }) {
    return new Hubspot(
      new DealManager(config?.deal ?? {}),
      new ContactManager(config?.contact ?? {}),
      new CompanyManager(),
    );
  }

  private constructor(
    public dealManager: DealManager,
    public contactManager: ContactManager,
    public companyManager: CompanyManager,
  ) { }

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
