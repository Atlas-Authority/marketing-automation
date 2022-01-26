import { hubspotContactConfigFromENV, hubspotDealConfigFromENV } from "../config/env";
import { Logger } from "../log";
import { CompanyManager } from "../model/company";
import { ContactManager, HubspotContactConfig } from "../model/contact";
import { DealManager, HubspotDealConfig } from "../model/deal";

export class Hubspot {

  public static live(log: Logger) {
    return new Hubspot(
      new DealManager(hubspotDealConfigFromENV(), log),
      new ContactManager(hubspotContactConfigFromENV(), log),
      new CompanyManager(log),
    );
  }

  public static memoryFromENV(log?: Logger) {
    return this.memory({
      contact: hubspotContactConfigFromENV(),
      deal: hubspotDealConfigFromENV(),
    }, log);
  }

  public static memory(config?: { deal?: HubspotDealConfig, contact?: HubspotContactConfig }, log?: Logger) {
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

}
