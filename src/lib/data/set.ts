import { mpacConfigFromENV } from "../config/env";
import { Hubspot, HubspotConfig, hubspotConfigFromENV } from "../hubspot";
import { LogDir } from "../log";
import { Marketplace, MpacConfig } from "../marketplace";

export type DataSetConfig = {
  mpacConfig?: MpacConfig;
  hubspotConfig?: HubspotConfig;
};

export class DataSet {

  public freeEmailDomains = new Set<string>();
  public hubspot;
  public mpac;

  makeLogDir?: (name: string) => LogDir;

  public constructor(config?: DataSetConfig) {
    this.hubspot = new Hubspot(config?.hubspotConfig);
    this.mpac = new Marketplace(config?.mpacConfig);
  }

}

export function dataSetConfigFromENV(): DataSetConfig {
  return {
    mpacConfig: mpacConfigFromENV(),
    hubspotConfig: hubspotConfigFromENV(),
  };
}
