import { runDealGenerator, runDealGeneratorTwice } from "./utils";


it(`Sets partner domain on deal if record is partner-transacted`, () => {
  const { deals, contacts } = runDealGeneratorTwice({
    records: [
      ["1111111", "2021-12-26", "EVALUATION", "inactive", []],
      ["2222222", "2021-12-27", "COMMERCIAL", "active", []],
    ],
    partnerLicenseIds: ['2222222'],
    uniqueEmailForLicenses: ['2222222'],
  });

  expect(deals.length).toBe(1);
  expect(contacts.length).toBe(2);

  expect(deals[0].data.associatedPartner)
    .toBe(contacts[1].data.email.split('@')[1]);
});

it(`Sets partner domain on deal if record is partner-transacted even if newer one is not`, () => {
  const { deals, contacts } = runDealGeneratorTwice({
    records: [
      ["1111111", "2021-12-26", "EVALUATION", "inactive", []],
      ["2222222", "2021-12-27", "COMMERCIAL", "active", []],
    ],
    partnerLicenseIds: ['1111111'],
    uniqueEmailForLicenses: ['1111111'],
  });

  expect(deals.length).toBe(1);
  expect(contacts.length).toBe(2);

  expect(deals[0].data.associatedPartner)
    .toBe(contacts[0].data.email.split('@')[1]);
});

it(`Sets partner domain on contact if latest record is partner-transacted`, () => {
  const { contacts } = runDealGenerator({
    records: [
      ["1111111", "2021-12-26", "EVALUATION", "inactive", []],
      ["2222222", "2021-12-27", "COMMERCIAL", "active", []],
    ],
    partnerLicenseIds: ['1111111'],
    uniqueEmailForLicenses: ['1111111'],
  });

  expect(contacts.length).toBe(2);

  const [c1, c2] = contacts;

  expect(c1.data.lastAssociatedPartner).toEqual(c1.data.email.split('@')[1]);
  expect(c2.data.lastAssociatedPartner).toEqual(null);
});

it(`Unsets partner domain on contact if latest record is not partner-transacted`, () => {
  const { contacts } = runDealGeneratorTwice({
    records: [
      ["1111111", "2021-12-26", "EVALUATION", "inactive", []],
      ["2222222", "2021-12-27", "COMMERCIAL", "active", []],
    ],
    partnerLicenseIds: ['1111111'],
    uniqueEmailForLicenses: ['2222222'],
  });

  expect(contacts.length).toBe(2);

  const [c1, c2] = contacts;

  expect(c1.isPartner).toBeTruthy();
  expect(c2.isPartner).toBeTruthy();

  expect(c2.data.lastAssociatedPartner).toEqual(null);
});
