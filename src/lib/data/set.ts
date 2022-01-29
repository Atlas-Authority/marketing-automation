import { mpacConfigFromENV } from "../config/env";
import { deriveMultiProviderDomainsSet } from "../engine/all-free-email-providers";
import { Hubspot, HubspotConfig, hubspotConfigFromENV } from "../hubspot";
import { LogDir } from "../log";
import { Marketplace, MpacConfig } from "../marketplace";
import { RawDataSet } from "./raw";

export type DataSetConfig = {
  mpacConfig?: MpacConfig;
  hubspotConfig?: HubspotConfig;
};

export class DataSet {

  public freeEmailDomains = new Set<string>();
  public hubspot;
  public mpac;

  makeLogDir?: (name: string) => LogDir;

  public constructor(data: RawDataSet, config?: DataSetConfig) {
    this.hubspot = new Hubspot(config?.hubspotConfig);
    this.mpac = new Marketplace(config?.mpacConfig);

    this.freeEmailDomains = deriveMultiProviderDomainsSet(data.freeDomains);
    this.hubspot.importData(data);
    this.mpac.importData(data);
  }

}

export function dataSetConfigFromENV(): DataSetConfig {
  return {
    mpacConfig: mpacConfigFromENV(),
    hubspotConfig: hubspotConfigFromENV(),
  };
}
