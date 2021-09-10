import { DealRelevantEvent } from "./events.js";

export class ActionGenerator {

  allTransactionDeals = new Map<string, Deal>();
  allLicenseDeals = new Map<string, Deal>();

  constructor(initialDeals: Deal[]) {
    for (const deal of initialDeals) {
      if (deal.properties.addonlicenseid) {
        this.allLicenseDeals.set(deal.properties.addonlicenseid, deal);
      }
      if (deal.properties.transactionid) {
        this.allLicenseDeals.set(deal.properties.transactionid, deal);
      }
    }
  }

  generateFrom(events: DealRelevantEvent[], groups: RelatedLicenseSet) {
    const licenseDeals = new Set<Deal>();
    for (const license of groups.map(g => g.license)) {
      const deal = this.allLicenseDeals.get(license.addonLicenseId);
      if (deal) licenseDeals.add(deal);
    }

    const transactionDeals = new Set<Deal>();
    for (const transaction of groups.flatMap(g => g.transactions)) {
      const deal = this.allTransactionDeals.get(transaction.transactionId);
      if (deal) transactionDeals.add(deal);
    }

    // Hosting     State         Event              Action
    // ---------   -----------   ----------------   ----------------------------
    // Server/DC   No Deal       Eval               Create Eval
    // Server/DC   Eval Deal     Eval               Update Eval (CloseDate)
    // Server/DC   No Deal       Purchase           Create Won (Amount)
    // Server/DC   Eval Deal     Purchase           Close Won (Amount, CloseDate)
    // Server/DC                 Renew/Up/Down      Create Won (Amount)
    // Cloud       No Deal       Eval               Create Eval
    // Cloud                     Purchase           Create or Update Closed Won (CloseDate)
    // Cloud                     Renew/Up/Down      Create Won, (Amount)
    // Any         Closed Deal   All Txs Refunded   Update (CloseDate, Amount, Stage=Lost)

    const hosting = groups[0].license.hosting;
    for (const event of events) {

      switch (event.type) {
        case 'eval':

          switch (hosting) {
            case 'Server':
            case 'Data Center':
              // If existing eval deal:
              //   Update CloseDate
              // Else:
              //   Create Eval
              break;
            case 'Cloud':
              // If no existing eval deal:
              //   Create Eval
              break;
          }

          break;
        case 'purchase':

          switch (hosting) {
            case 'Server':
            case 'Data Center':
              break;
            case 'Cloud':
              break;
          }

          break;
        case 'renewal':
        case 'upgrade':

          switch (hosting) {
            case 'Server':
            case 'Data Center':
              break;
            case 'Cloud':
              break;
          }

          break;
        case 'refund':
          break;
      }

    }

    return [];
  }

}
