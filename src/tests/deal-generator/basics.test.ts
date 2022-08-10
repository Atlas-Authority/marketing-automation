import { runDealGenerator, runDealGeneratorTwice } from "./utils";


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
        ['AT-131949332', '2021-03-25', 'Renewal', 274],
        ['AT-97165138', '2020-04-07', 'Upgrade', 411]
      ]]
    ],
  });
  expect(events).toEqual([
    ['purchase', 'ALI-L2169473', 'ALI-2479625'],
    ['upgrade', 'AT-97165138[AEI-2479625]'],
    ['renewal', 'AT-131949332[AEI-2479625]']
  ]);
  expect(actions).toEqual([
    {
      Create: {
        dealStage: 'CLOSED_WON',
        addonLicenseId: '2479625',
        transactionId: null,
        closeDate: '2013-01-23',
        amount: 0
      }
    },
    {
      Create: {
        dealStage: 'CLOSED_WON',
        addonLicenseId: '2479625',
        transactionId: 'AT-97165138',
        closeDate: '2020-04-07',
        amount: 411
      }
    },
    {
      Create: {
        dealStage: 'CLOSED_WON',
        addonLicenseId: '2479625',
        transactionId: 'AT-131949332',
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
        ['AT-131949332', '2021-03-25', 'Renewal', 274],
        ['AT-97165138', '2020-04-07', 'Upgrade', 411]
      ]]
    ],
  });
  expect(events).toEqual([
    ['purchase', 'ALI-L2169473', 'ALI-2479625'],
    ['upgrade', 'AT-97165138[AEI-2479625]'],
    ['renewal', 'AT-131949332[AEI-2479625]']
  ]);
  expect(actions).toEqual([
    { Nothing: ['properties-up-to-date', ["2479625", "CLOSED_WON", 0,]] },
    { Nothing: ['properties-up-to-date', ["AT-97165138[2479625]", "CLOSED_WON", 411,]] },
    { Nothing: ['properties-up-to-date', ["AT-131949332[2479625]", "CLOSED_WON", 274,]] },
  ]);
});
