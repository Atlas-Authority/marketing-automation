import {runDealGenerator, runDealGeneratorTwice} from './utils'
import {Deal} from '../../lib/model/deal'

it(`Creates deal from purchase`, () => {
  const { events, actions } = runDealGenerator({
    records: [
      ['2454822', '2012-12-27', 'COMMERCIAL', 'inactive', []]
    ],
  });
  expect(events).toEqual([
    ['purchase', 'ALI-2454822']
  ]);
  expect(actions).toEqual([
    {
      Create: {
        dealStage: 'CLOSED_WON',
        addonLicenseId: '2454822',
        transactionId: null,
        transactionLineItemId: null,
        closeDate: '2012-12-27',
        amount: 0
      }
    }
  ]);
});

it(`Does not create deal from purchase when one already exists`, () => {
  const { events, actions } = runDealGeneratorTwice({
    records: [
      ['2454822', '2012-12-27', 'COMMERCIAL', 'inactive', []]
    ]
  });
  expect(events).toEqual([
    ['purchase', 'ALI-2454822']
  ]);
  expect(actions).toEqual([
    {
      Nothing: ['properties-up-to-date', ['2454822', 'CLOSED_WON', 0]]
    }
  ]);
});

it(`Creates deals for renewals and upgrades separately from purchases`, () => {
  const { events, actions } = runDealGenerator({
    records: [
      ['L2169473', '2013-01-21', 'EVALUATION', 'inactive', []],
      ['2479625', '2013-01-23', 'COMMERCIAL', 'active', [
        ['AT-131949332', '123', '2021-03-25', 'Renewal', 274],
        ['AT-97165138', '234', '2020-04-07', 'Upgrade', 411]
      ]]
    ],
  });
  expect(events).toEqual([
    ['purchase', 'ALI-L2169473', 'ALI-2479625'],
    ['upgrade', 'AT-97165138/234[AEI-2479625]'],
    ['renewal', 'AT-131949332/123[AEI-2479625]']
  ]);
  expect(actions).toEqual([
    {
      Create: {
        dealStage: 'CLOSED_WON',
        addonLicenseId: '2479625',
        transactionId: null,
        transactionLineItemId: null,
        closeDate: '2013-01-23',
        amount: 0
      }
    },
    {
      Create: {
        dealStage: 'CLOSED_WON',
        addonLicenseId: '2479625',
        transactionId: 'AT-97165138',
        transactionLineItemId: '234',
        closeDate: '2020-04-07',
        amount: 411
      }
    },
    {
      Create: {
        dealStage: 'CLOSED_WON',
        addonLicenseId: '2479625',
        transactionId: 'AT-131949332',
        transactionLineItemId: '123',
        closeDate: '2021-03-25',
        amount: 274
      }
    }
  ]);
});

it(`Does nothing when upgrades and renewals already have deals`, () => {
  const { events, actions } = runDealGeneratorTwice({
    records: [
      ['L2169473', '2013-01-21', 'EVALUATION', 'inactive', []],
      ['2479625', '2013-01-23', 'COMMERCIAL', 'active', [
        ['AT-131949332', '123', '2021-03-25', 'Renewal', 274],
        ['AT-97165138', '234', '2020-04-07', 'Upgrade', 411]
      ]]
    ],
  });
  expect(events).toEqual([
    ['purchase', 'ALI-L2169473', 'ALI-2479625'],
    ['upgrade', 'AT-97165138/234[AEI-2479625]'],
    ['renewal', 'AT-131949332/123[AEI-2479625]']
  ]);
  expect(actions).toEqual([
    { Nothing: ['properties-up-to-date', ["2479625", "CLOSED_WON", 0,]] },
    { Nothing: ['properties-up-to-date', ["AT-97165138/234[2479625]", "CLOSED_WON", 411,]] },
    { Nothing: ['properties-up-to-date', ["AT-131949332/123[2479625]", "CLOSED_WON", 274,]] },
  ]);
});

it(`Merges with existing deal by transactionId only when no transactionLineItemId`, () => {
  const { events, actions, deals } = runDealGenerator({
    addonKey: 'my-addon',
    deals: [
      {
        id: '1',
        data: {
          closeDate: '2021-09-24T00:00:00Z',
          maintenanceEndDate: '2022-03-25',
          addonLicenseId: '2479625',
          transactionId: 'AT-131949333',
          amount: 800.5,
          appEntitlementId: 'fa8499d1-a2ba-4489-b428-55adbff63f66',
          appEntitlementNumber: 'E-3X6-TZ7-275-XN6'
        }
      } as Deal
    ] as Deal[],
    records: [
      ['2479625', '2013-01-23', 'COMMERCIAL', 'active', [
        ['AT-131949333', '2', '2022-03-25', 'New', 300.5],
      ]]
    ]
  })

  expect(events).toEqual([
    [ 'purchase', 'ALI-2479625', 'AT-131949333/2[AEI-2479625]' ]
  ])
  expect(actions).toEqual([
    {
      Update: [
        "1",
        {
          addonLicenseId: "",
          transactionLineItemId: "2",
          closedate: "2022-03-25",
          dealname: "Deal",
          amount: "300.5",
          appEntitlementNumber: ""
        }
      ]
    }
  ])
  expect(deals.map(d => d.toRawEntity())).toEqual([
    {
      id: '1',
      properties: {
        aa_app: 'my-addon',
        addonLicenseId: '',
        amount: '300.5',
        appEntitlementId: '2479625',
        appEntitlementNumber: '',
        dealname: 'Deal',
        transactionId: 'AT-131949333',
        transactionLineItemId: '2',
        licenseTier: 'Unlimited Users',
        maintenance_end_date: '2022-03-25',
        pipeline: 'Pipeline',
        closedate: '2022-03-25',
        dealstage: 'ClosedWon'
      },
      associations: [ 'deal_to_contact:fake-contact-1' ]
    }
  ])
})

it(`Merges with existing deal by transactionId and transactionLineItemId`, () => {
  const { events, actions, deals } = runDealGenerator({
    addonKey: 'my-addon',
    deals: [
      {
        id: '1',
        data: {
          closeDate: '2021-09-24T00:00:00Z',
          maintenanceEndDate: '2022-03-25',
          addonLicenseId: '2479625',
          transactionId: 'AT-131949333',
          transactionLineItemId: "2",
          amount: 800.5,
          appEntitlementId: 'fa8499d1-a2ba-4489-b428-55adbff63f66',
          appEntitlementNumber: 'E-3X6-TZ7-275-XN6'
        }
      } as Deal
    ] as Deal[],
    records: [
      ['2479625', '2013-01-23', 'COMMERCIAL', 'active', [
        ['AT-131949333', '2', '2022-03-25', 'New', 300.5],
      ]]
    ]
  })

  expect(events).toEqual([
    [ 'purchase', 'ALI-2479625', 'AT-131949333/2[AEI-2479625]' ]
  ])
  expect(actions).toEqual([
    {
      Update: [
        "1",
        {
          addonLicenseId: "",
          closedate: "2022-03-25",
          dealname: "Deal",
          amount: "300.5",
          appEntitlementNumber: ""
        }
      ]
    }
  ])
  expect(deals.map(d => d.toRawEntity())).toEqual([
    {
      id: '1',
      properties: {
        aa_app: 'my-addon',
        addonLicenseId: '',
        amount: '300.5',
        appEntitlementId: '2479625',
        appEntitlementNumber: '',
        dealname: 'Deal',
        transactionId: 'AT-131949333',
        transactionLineItemId: '2',
        licenseTier: 'Unlimited Users',
        maintenance_end_date: '2022-03-25',
        pipeline: 'Pipeline',
        closedate: '2022-03-25',
        dealstage: 'ClosedWon'
      },
      associations: [ 'deal_to_contact:fake-contact-1' ]
    }
  ])
})

it(`Create new deal when transactionLineItemId differs`, () => {
  const { events, actions, deals } = runDealGenerator({
    addonKey: 'my-addon',
    deals: [
      {
        id: '1',
        data: {
          closeDate: '2021-09-24T00:00:00Z',
          maintenanceEndDate: '2022-03-25',
          addonLicenseId: '2479625',
          transactionId: 'AT-131949333',
          transactionLineItemId: "1",
          amount: 800.5,
          appEntitlementId: 'fa8499d1-a2ba-4489-b428-55adbff63f66',
          appEntitlementNumber: 'E-3X6-TZ7-275-XN6'
        }
      } as Deal
    ] as Deal[],
    records: [
      ['2479625', '2013-01-23', 'COMMERCIAL', 'active', [
        ['AT-131949333', '2', '2022-03-25', 'New', 300.5],
      ]]
    ]
  })
  expect(events).toEqual([
    [ 'purchase', 'ALI-2479625', 'AT-131949333/2[AEI-2479625]' ]
  ])
  expect(actions).toEqual([
    {
      Create:
        {
          addonLicenseId: "2479625",
          closeDate: "2022-03-25",
          dealStage: "CLOSED_WON",
          amount: 300.5,
          transactionId: "AT-131949333",
          transactionLineItemId: "2",
        }
    }
  ])
  expect(deals.map(d => d.toRawEntity())).toEqual([
    {
      id: '1',
      properties: {
        aa_app: 'my-addon',
        addonLicenseId: '2479625',
        amount: '800.5',
        appEntitlementId: '2479625',
        appEntitlementNumber: '2479625',
        dealname: 'Deal: 2479625',
        transactionId: 'AT-131949333',
        transactionLineItemId: '1',
        licenseTier: 'Unlimited Users',
        maintenance_end_date: '2022-03-25',
        pipeline: 'Pipeline',
        closedate: '2021-09-24',
        dealstage: 'ClosedWon'
      },
      associations: []
    },
    {
      id: 'fake-deal-1',
      properties: {
        closedate: '2022-03-25',
        dealname: 'Deal',
        pipeline: 'Pipeline',
        addonLicenseId: '',
        transactionId: 'AT-131949333',
        transactionLineItemId: '2',
        appEntitlementId: '2479625',
        appEntitlementNumber: '',
        dealstage: 'ClosedWon',
        amount: '300.5'
      },
      associations: [ 'deal_to_contact:fake-contact-1' ]
    }

  ])
})
