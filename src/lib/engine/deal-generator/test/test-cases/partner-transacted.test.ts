import { runDealGeneratorTwice, testLicense } from "../utils";


it(`Sets partner domain on deal if record is partern-transacted`, () => {
  const license1 = testLicense("1111111", "2021-12-26", "EVAL", "inactive");
  const license2 = testLicense("2222222", "2021-12-27", "COMMERCIAL", "active");
  const partnerDomain = license2.data.technicalContact.email.split('@')[1];

  const { db } = runDealGeneratorTwice({
    group: [['1111111', []], ['2222222', []]],
    records: [license1, license2],
    partnerDomains: [partnerDomain],
  });

  const deals = db.dealManager.getArray();
  expect(deals.length).toBe(1);

  const deal = deals[0];
  expect(deal.data.associatedPartner).toEqual(partnerDomain);
});
