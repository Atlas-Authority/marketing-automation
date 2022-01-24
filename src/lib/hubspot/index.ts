import { hubspotContactConfigFromENV, hubspotDealConfigFromENV } from "../parameters/env-config";
import HubspotAPI from "./api";
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

  public async upsyncChangesLive(api: HubspotAPI) {
    await this.dealManager.syncUpAllEntities(api);
    await this.contactManager.syncUpAllEntities(api);
    await this.companyManager.syncUpAllEntities(api);

    await this.dealManager.syncUpAllAssociations(api);
    await this.contactManager.syncUpAllAssociations(api);
    await this.companyManager.syncUpAllAssociations(api);
  }

}
