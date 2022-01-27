import { hubspotContactConfigFromENV, hubspotDealConfigFromENV } from "../config/env";
import { Console } from "../log/console";
import { CompanyManager } from "../model/company";
import { ContactManager, HubspotContactConfig } from "../model/contact";
import { DealManager, HubspotDealConfig } from "../model/deal";
import { Entity } from "./entity";

export class Hubspot {

  public static live(console: Console) {
    return new Hubspot(
      new DealManager(hubspotDealConfigFromENV(), console),
      new ContactManager(hubspotContactConfigFromENV(), console),
      new CompanyManager(console),
    );
  }

  public static memoryFromENV(console?: Console) {
    return this.memory({
      contact: hubspotContactConfigFromENV(),
      deal: hubspotDealConfigFromENV(),
    }, console);
  }

  public static memory(config?: { deal?: HubspotDealConfig, contact?: HubspotContactConfig }, console?: Console) {
    return new Hubspot(
      new DealManager(config?.deal ?? {}, console),
      new ContactManager(config?.contact ?? {}, console),
      new CompanyManager(console),
    );
  }

  private constructor(
    public dealManager: DealManager,
    public contactManager: ContactManager,
    public companyManager: CompanyManager,
  ) { }

  public async upsyncChangesToHubspot() {
    const dealUploader = this.dealManager.makeUploader();
    const contactUploader = this.contactManager.makeUploader();
    const companyUploader = this.companyManager.makeUploader();

    await dealUploader.syncUpAllEntitiesProperties();
    await contactUploader.syncUpAllEntitiesProperties();
    await companyUploader.syncUpAllEntitiesProperties();

    await dealUploader.syncUpAllAssociations();
    await contactUploader.syncUpAllAssociations();
    await companyUploader.syncUpAllAssociations();
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
