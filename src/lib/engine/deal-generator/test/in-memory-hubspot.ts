import { AbstractMemoryHubspot } from "../../../io/memory/hubspot";
import {EntityKind, FullEntity} from "../../../model/hubspot/interfaces";

export class InMemoryHubspot extends AbstractMemoryHubspot {
  public constructor(private deals: FullEntity[], private companies: FullEntity[], private contacts: FullEntity[]) {
    super();
  }

  protected arrayFor(kind: EntityKind): FullEntity[] {
    switch (kind) {
      case 'deal': return this.deals;
      case 'company': return this.companies;
      case 'contact': return this.contacts;
    }
  }

}
