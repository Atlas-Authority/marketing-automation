import { hubspotContactConfigFromENV, hubspotDealConfigFromENV } from "../parameters/env-config";
import HubspotAPI from "./api";
import { CompanyManager } from "./model/company";
import { ContactManager } from "./model/contact";
import { DealManager } from "./model/deal";

export class HubspotService {

  public static live() {
    const api = new HubspotAPI();
    return new HubspotService(
      new DealManager(api, hubspotDealConfigFromENV()),
      new ContactManager(api, hubspotContactConfigFromENV()),
      new CompanyManager(api),
    );
  }

  public static memory() {
    return new HubspotService(
      new DealManager(null, {}),
      new ContactManager(null, {}),
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
