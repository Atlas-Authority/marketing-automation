import { runDealGenerator, runDealGeneratorTwice, testLicense } from "./utils";


it(`Sets partner domain on deal if record is partner-transacted`, () => {
  const license1 = testLicense("1111111", "2021-12-26", "EVAL", "inactive");
  const license2 = testLicense("2222222", "2021-12-27", "COMMERCIAL", "active");
  const partnerDomain = license2.data.technicalContact.email.split('@')[1];

  const { engine } = runDealGeneratorTwice({
    group: [['1111111', []], ['2222222', []]],
    records: [license1, license2],
    partnerDomains: [partnerDomain],
  });

  const deals = engine.dealManager.getArray();
  expect(deals.length).toBe(1);

  const deal = deals[0];
  expect(deal.data.associatedPartner).toEqual(partnerDomain);
});

it(`Sets partner domain on deal if record is partner-transacted even if newer one is not`, () => {
  const license1 = testLicense("1111111", "2021-12-26", "EVAL", "inactive");
  const license2 = testLicense("2222222", "2021-12-27", "COMMERCIAL", "active");
  const partnerDomain = license1.data.technicalContact.email.split('@')[1];

  const { engine } = runDealGeneratorTwice({
    group: [['1111111', []], ['2222222', []]],
    records: [license1, license2],
    partnerDomains: [partnerDomain],
  });

  const deals = engine.dealManager.getArray();
  expect(deals.length).toBe(1);

  const deal = deals[0];
  expect(deal.data.associatedPartner).toEqual(partnerDomain);
});

it(`Sets partner domain on contact if latest record is partner-transacted`, () => {
  const license1 = testLicense("1111111", "2021-12-26", "EVAL", "inactive", "foo@domain1.example.com");
  const license2 = testLicense("2222222", "2021-12-27", "COMMERCIAL", "active", "foo@domain2.example.com");
  const partnerDomain = "domain1.example.com";

  const { engine } = runDealGenerator({
    group: [['1111111', []], ['2222222', []]],
    records: [license1, license2],
    partnerDomains: [partnerDomain],
  });

  const contacts = engine.contactManager.getArray();
  expect(contacts.length).toBe(2);

  const [c1, c2] = contacts;
  expect(c1.data.email).toEqual("foo@domain1.example.com");
  expect(c2.data.email).toEqual("foo@domain2.example.com");

  expect(c1.data.lastAssociatedPartner).toEqual("domain1.example.com");
  expect(c2.data.lastAssociatedPartner).toEqual(null);
});
