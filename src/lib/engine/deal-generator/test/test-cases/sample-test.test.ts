import { runDealGenerator } from "../utils";

it(`Creates deal from purchase`, () => {
  const { events, actions } = runDealGenerator({
    deals: [],
    matchGroup: [
      {
        license: {
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
        },
        transactions: []
      }
    ]
  });
  expect(events).toEqual([{ type: 'purchase', lics: ['2454822'], txs: [undefined] }]);
  expect(actions).toEqual([
    {
      type: 'create',
      data: {
        dealStage: 1,
        addonLicenseId: '2454822',
        transactionId: null,
        closeDate: '2012-12-27',
        deployment: 'Server',
        app: 'naok',
        licenseTier: 10001,
        country: 'NU',
        origin: 'MPAC Lead',
        relatedProducts: 'Marketplace Apps',
        dealName: 'Buowsi at Quanta Services Inc.',
        pipeline: 0,
        amount: 0
      }
    }
  ]);
});

it(`Does nothing when deal exists for purchase`, () => {
  const { events, actions } = runDealGenerator({
    deals: [
      {
        dealStage: 1,
        addonLicenseId: '2454822',
        transactionId: null,
        closeDate: '2012-12-27',
        deployment: 'Server',
        app: 'naok',
        licenseTier: 10001,
        country: 'NU',
        origin: 'MPAC Lead',
        relatedProducts: 'Marketplace Apps',
        dealName: 'Buowsi at Quanta Services Inc.',
        pipeline: 0,
        amount: 0
      }
    ],
    matchGroup: [
      {
        license: {
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
        },
        transactions: []
      }
    ]
  });
  expect(events).toEqual([{ type: 'purchase', lics: ['2454822'], txs: [undefined] }]);
  expect(actions).toEqual([
    {
      deal: "deal-0",
      type: "noop",
    },
  ]);
});
