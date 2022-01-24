import { hubspotContactConfigFromENV, hubspotDealConfigFromENV } from "../parameters/env-config";
import HubspotAPI from "./api";
import { CompanyManager } from "./model/company";
import { ContactManager, HubspotContactConfig } from "./model/contact";
import { DealManager, HubspotDealConfig } from "./model/deal";

export class HubspotService {

  public static live() {
    const api = new HubspotAPI();
    return new HubspotService(
      new DealManager(api, hubspotDealConfigFromENV()),
      new ContactManager(api, hubspotContactConfigFromENV()),
      new CompanyManager(api),
    );
  }

  public static memoryFromENV() {
    return this.memory({
      contact: hubspotContactConfigFromENV(),
      deal: hubspotDealConfigFromENV(),
    });
  }

  public static memory(config?: { deal?: HubspotDealConfig, contact?: HubspotContactConfig }) {
    return new HubspotService(
      new DealManager(null, config?.deal ?? {}),
      new ContactManager(null, config?.contact ?? {}),
      new CompanyManager(null),
    );
  }

  private constructor(
    public dealManager: DealManager,
    public contactManager: ContactManager,
    public companyManager: CompanyManager,
  ) { }

  public async upsyncChanges() {
    await this.dealManager.syncUpAllEntities();
    await this.contactManager.syncUpAllEntities();
    await this.companyManager.syncUpAllEntities();

    await this.dealManager.syncUpAllAssociations();
    await this.contactManager.syncUpAllAssociations();
    await this.companyManager.syncUpAllAssociations();
  }

}
