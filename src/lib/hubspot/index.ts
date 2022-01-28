import { hubspotContactConfigFromENV, hubspotDealConfigFromENV } from "../config/env";
import { ConsoleLogger } from "../log/console";
import { CompanyManager } from "../model/company";
import { ContactManager, HubspotContactConfig } from "../model/contact";
import { DealManager, HubspotDealConfig } from "../model/deal";
import { Entity } from "./entity";
import { HubspotUploader } from "./uploader";

export class Hubspot {

  public static live(console: ConsoleLogger) {
    return new Hubspot(
      new DealManager(hubspotDealConfigFromENV()),
      new ContactManager(hubspotContactConfigFromENV()),
      new CompanyManager(),
      console,
    );
  }

  public static memoryFromENV(console?: ConsoleLogger) {
    return this.memory({
      contact: hubspotContactConfigFromENV(),
      deal: hubspotDealConfigFromENV(),
    }, console);
  }

  public static memory(config?: { deal?: HubspotDealConfig, contact?: HubspotContactConfig }, console?: ConsoleLogger) {
    return new Hubspot(
      new DealManager(config?.deal ?? {}),
      new ContactManager(config?.contact ?? {}),
      new CompanyManager(),
      console,
    );
  }

  private constructor(
    public dealManager: DealManager,
    public contactManager: ContactManager,
    public companyManager: CompanyManager,
    private console?: ConsoleLogger,
  ) { }

  public async upsyncChangesToHubspot() {
    new HubspotUploader(this, this.console).upsyncChangesToHubspot();
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
