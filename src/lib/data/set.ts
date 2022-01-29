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

  public constructor(public rawData: RawDataSet, config?: DataSetConfig) {
    this.hubspot = new Hubspot(config?.hubspotConfig);
    this.mpac = new Marketplace(config?.mpacConfig);

    this.freeEmailDomains = deriveMultiProviderDomainsSet(rawData.freeDomains);
    this.hubspot.importData(rawData);
    this.mpac.importData(rawData);
  }

}

export function dataSetConfigFromENV(): DataSetConfig {
  return {
    mpacConfig: mpacConfigFromENV(),
    hubspotConfig: hubspotConfigFromENV(),
  };
}
