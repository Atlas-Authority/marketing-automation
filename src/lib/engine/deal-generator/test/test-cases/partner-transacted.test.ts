import { runDealGeneratorTwice, testLicense } from "../utils";


it(`Sets partner domain on deal if record is partern-transacted`, () => {
  const license1 = testLicense("2454822", "2012-12-27", "COMMERCIAL", "inactive");
  const domain1 = license1.data.technicalContact.email.split('@')[1];

  const { db } = runDealGeneratorTwice({
    group: [['2454822', []]],
    records: [
      license1
    ],
    partnerDomains: [domain1],
  });

  const deals = db.dealManager.getArray();
  expect(deals.length).toBe(1);

  const deal = deals[0];
  expect(deal.data.associatedPartner).toEqual(domain1);
});
