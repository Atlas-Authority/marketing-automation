import { runDealGenerator, testLicense, testTransaction } from "../utils";


it(`Creates deal from purchase`, () => {
  const { events, actions } = runDealGenerator({
    group: [['2454822', []]],
    deals: [],
    records: [
      testLicense("2454822", "2012-12-27", "COMMERCIAL", "inactive")
    ],
  });
  expect(events).toEqual([
    ['purchase', '2454822']
  ]);
  expect(actions).toEqual([
    [
      'Create',
      {
        dealStage: 'CLOSED_WON',
        addonLicenseId: '2454822',
        transactionId: null,
        closeDate: '2012-12-27',
        amount: 0
      }
    ]
  ]);
});

it(`Creates deals for renewals and upgrades separately from purchases`, () => {
  const { events, actions } = runDealGenerator({
    group: [['L2169473', []], ['2479625', ['AT-131949332[2479625]', 'AT-97165138[2479625]']]],
    deals: [],
    records: [
      testLicense("L2169473", "2013-01-21", "EVALUATION", "inactive"),
      testLicense("2479625", "2013-01-23", "COMMERCIAL", "active"),
      testTransaction("2479625", "2020-04-07", "COMMERCIAL", "Upgrade", "AT-97165138", 807),
      testTransaction("2479625", "2021-04-07", "COMMERCIAL", "Renewal", "AT-131949332", 222)
    ],
  });
  expect(events).toEqual([
    ['purchase', 'L2169473', '2479625'],
    ['upgrade', 'AT-97165138[2479625]'],
    ['renewal', 'AT-131949332[2479625]']
  ]);
  expect(actions).toEqual([
    [
      'Create',
      {
        dealStage: 'CLOSED_WON',
        addonLicenseId: '2479625',
        transactionId: null,
        closeDate: '2013-01-23',
        amount: 0
      }
    ],
    [
      'Create',
      {
        dealStage: 'CLOSED_WON',
        addonLicenseId: '2479625',
        transactionId: 'AT-97165138',
        closeDate: '2020-04-07',
        amount: 807
      }
    ],
    [
      'Create',
      {
        dealStage: 'CLOSED_WON',
        addonLicenseId: '2479625',
        transactionId: 'AT-131949332',
        closeDate: '2021-03-25',
        amount: 222
      }
    ]
  ]);
});


