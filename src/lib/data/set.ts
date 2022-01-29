import { mpacConfigFromENV } from "../config/env";
import { deriveMultiProviderDomainsSet } from "../engine/all-free-email-providers";
import { Hubspot, HubspotConfig, hubspotConfigFromENV } from "../hubspot/hubspot";
import { LogDir } from "../log/logdir";
import { Marketplace, MpacConfig } from "../marketplace/marketplace";
import { RawDataSet } from "./raw";

export type DataSetConfig = {
  mpacConfig?: MpacConfig;
  hubspotConfig?: HubspotConfig;
};

export class DataSet {

  public static fromDataSet(other: DataSet) {
    other.rawData.rawDeals = other.hubspot.dealManager.getArray().map(e => e.toRawEntity());
    other.rawData.rawContacts = other.hubspot.contactManager.getArray().map(e => e.toRawEntity());
    other.rawData.rawCompanies = other.hubspot.companyManager.getArray().map(e => e.toRawEntity());

    const newDataSet = new DataSet(other.rawData, other.config);
    newDataSet.makeLogDir = other.makeLogDir;
    return newDataSet;
  }

  public freeEmailDomains = new Set<string>();
  public hubspot;
  public mpac;

  public makeLogDir?: (name: string) => LogDir;

  public constructor(public rawData: RawDataSet, private config?: DataSetConfig) {
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
