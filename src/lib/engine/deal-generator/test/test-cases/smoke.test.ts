import { License } from "../../../../model/license";
import { runDealGenerator } from "../utils";

it(`Sets deal properties correctly`, () => {
  const { events, actions } = runDealGenerator({
    deals: [],
    group: [['2454822', []]],
    records: [
      new License({
        addonLicenseId: '2454822',
        licenseId: 'SEN-2454822',
        addonKey: 'naok',
        addonName: 'Buowsi',
        lastUpdated: '2015-11-14',
        technicalContact: { email: 'zoj@kig.tr', name: 'Landon Williams' },
        billingContact: { email: 'zoj@kig.tr', name: 'Landon Williams' },
        partnerDetails: null,
        company: 'Quanta Services Inc.',
        country: 'NU',
        region: 'Americas',
        tier: 'Unlimited Users',
        licenseType: 'COMMERCIAL',
        hosting: 'Server',
        maintenanceStartDate: '2012-12-27',
        maintenanceEndDate: '2013-12-27',
        status: 'inactive',
        evaluationOpportunitySize: 'NA',
        attribution: null,
        parentInfo: null,
        newEvalData: null
      })
    ]
  });
  expect(events).toEqual([
    ["purchase", "2454822"]
  ]);
  expect(actions).toEqual([
    [
      "Create",
      {
        addonLicenseId: "2454822",
        amount: 0,
        closeDate: "2012-12-27",
        dealStage: "CLOSED_WON",
        transactionId: null,
      },
    ]
  ]);
});
