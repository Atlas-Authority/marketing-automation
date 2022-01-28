import { Hubspot } from "../hubspot";
import { Marketplace } from "../marketplace";

export class DataSet {

  public freeEmailDomains = new Set<string>();

  public static fromENV() {
    return new DataSet(Hubspot.fromENV(), Marketplace.fromENV());
  }

  public constructor(
    public hubspot: Hubspot,
    public mpac: Marketplace,
  ) {
  }

}
