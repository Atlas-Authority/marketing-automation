import { hubspotContactConfigFromENV, hubspotDealConfigFromENV } from "../parameters/env-config";
import { CompanyManager } from "./model/company";
import { ContactManager, HubspotContactConfig } from "./model/contact";
import { DealManager, HubspotDealConfig } from "./model/deal";

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
