import { hubspotContactConfigFromENV, hubspotDealConfigFromENV, mpacConfigFromENV } from "../config/env";
import { Hubspot, HubspotConfig } from "../hubspot";
import { Marketplace, MpacConfig } from "../marketplace";

export type DataSetConfig = {
  mpacConfig?: MpacConfig;
  hubspotConfig?: HubspotConfig;
};

export class DataSet {

  public freeEmailDomains = new Set<string>();

  public hubspot;
  public mpac;

  public constructor(config?: DataSetConfig) {
    this.hubspot = new Hubspot(config?.hubspotConfig);
    this.mpac = new Marketplace(config?.mpacConfig);
  }

}

export function dataSetConfigFromENV(): DataSetConfig {
  return {
    mpacConfig: mpacConfigFromENV(),
    hubspotConfig: {
      contact: hubspotContactConfigFromENV(),
      deal: hubspotDealConfigFromENV(),
    },
  };
}
