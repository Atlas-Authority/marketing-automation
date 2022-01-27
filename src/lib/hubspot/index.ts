import { hubspotContactConfigFromENV, hubspotDealConfigFromENV } from "../config/env";
import { ConsoleLogger } from "../log/console";
import { CompanyManager } from "../model/company";
import { ContactManager, HubspotContactConfig } from "../model/contact";
import { DealManager, HubspotDealConfig } from "../model/deal";
import { Entity } from "./entity";

export class Hubspot {

  public static live(log: ConsoleLogger) {
    return new Hubspot(
      new DealManager(hubspotDealConfigFromENV(), log),
      new ContactManager(hubspotContactConfigFromENV(), log),
      new CompanyManager(log),
    );
  }

  public static memoryFromENV(log?: ConsoleLogger) {
    return this.memory({
      contact: hubspotContactConfigFromENV(),
      deal: hubspotDealConfigFromENV(),
    }, log);
  }

  public static memory(config?: { deal?: HubspotDealConfig, contact?: HubspotContactConfig }, log?: ConsoleLogger) {
    return new Hubspot(
      new DealManager(config?.deal ?? {}, log),
      new ContactManager(config?.contact ?? {}, log),
      new CompanyManager(log),
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
