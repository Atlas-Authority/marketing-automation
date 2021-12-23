import { DealStage } from "../../../../model/hubspot/interfaces";
import { runDealGenerator, testDeal, testLicense } from "../utils";

it(`Creates deal from purchase`, () => {
  const { events, actions } = runDealGenerator({
    deals: [],
    matchGroup: [
      {
        license: testLicense({
          addonLicenseId: '2454822',
          licenseType: 'COMMERCIAL',
          lastUpdated: '2015-11-14',
          maintenanceStartDate: '2012-12-27',
          maintenanceEndDate: '2013-12-27',
          status: 'inactive',
        }),
        transactions: []
      }
    ]
  });
  expect(events).toEqual([{
    type: 'purchase',
    lics: ['2454822'],
    txs: [undefined],
  }]);
  expect(actions).toEqual([
    {
      type: 'create',
      data: testDeal({
        dealStage: DealStage.CLOSED_WON,
        addonLicenseId: '2454822',
        transactionId: null,
        closeDate: '2012-12-27',
        amount: 0
      })
    }
  ]);
});

it(`Does nothing when deal exists for purchase`, () => {
  const { events, actions } = runDealGenerator({
    deals: [
      testDeal({
        dealStage: DealStage.CLOSED_WON,
        addonLicenseId: '2454822',
        transactionId: null,
        closeDate: '2012-12-27',
        amount: 0
      })
    ],
    matchGroup: [
      {
        license: testLicense({
          addonLicenseId: '2454822',
          licenseType: 'COMMERCIAL',
          lastUpdated: '2015-11-14',
          maintenanceStartDate: '2012-12-27',
          maintenanceEndDate: '2013-12-27',
          status: 'inactive',
        }),
        transactions: []
      }
    ]
  });
  expect(events).toEqual([{
    type: 'purchase',
    lics: ['2454822'],
    txs: [undefined],
  }]);
  expect(actions).toEqual([
    {
      deal: "deal-0",
      type: "noop",
    },
  ]);
});
