import { ConsoleLogger } from "../log/logger";
import { hubspotContactConfigFromENV, hubspotDealConfigFromENV } from "../parameters/env-config";
import { CompanyManager } from "./model/company";
import { ContactManager, HubspotContactConfig } from "./model/contact";
import { DealManager, HubspotDealConfig } from "./model/deal";

export class Hubspot {

  public static live(log: ConsoleLogger) {
    return new Hubspot(
      new DealManager(log, hubspotDealConfigFromENV()),
      new ContactManager(log, hubspotContactConfigFromENV()),
      new CompanyManager(log),
    );
  }

  public static memoryFromENV(log: ConsoleLogger | null) {
    return this.memory(log, {
      contact: hubspotContactConfigFromENV(),
      deal: hubspotDealConfigFromENV(),
    });
  }

  public static memory(log: ConsoleLogger | null, config?: { deal?: HubspotDealConfig, contact?: HubspotContactConfig }) {
    return new Hubspot(
      new DealManager(log, config?.deal ?? {}),
      new ContactManager(log, config?.contact ?? {}),
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
