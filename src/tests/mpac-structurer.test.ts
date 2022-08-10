import Chance from 'chance';
import { buildAndVerifyStructures } from "../lib/marketplace/structure";
import { License } from "../lib/model/license";

const chance = new Chance();

describe(`MPAC Structurer`, () => {

  it(`Works with empty data`, () => {
    const result = buildAndVerifyStructures([], []);
    expect(result.licenses).toEqual([]);
    expect(result.transactions).toEqual([]);
  });

  it(`Allows addonLicenseId to be the same value as appEntitlementNumber within a license`, () => {
    const id = 'id1';
    const start = '2022-01-01';

    const result = buildAndVerifyStructures([
      License.fromRaw({
        addonKey: 'addonKey-123',
        addonName: chance.sentence({ words: 3, punctuation: false }),
        hosting: 'Server',
        lastUpdated: start,
        contactDetails: {
          company: chance.company(),
          country: chance.country(),
          region: chance.pickone(['EMEA', 'Americas', 'APAC', 'Unknown']),
          technicalContact: {
            email: 'email-123@example.com',
          },
        },
        addonLicenseId: id,
        appEntitlementId: id,
        appEntitlementNumber: id,
        licenseId: id,
        licenseType: 'EVALUATION',
        maintenanceStartDate: start,
        maintenanceEndDate: start,
        status: 'active',
        tier: 'Unlimited Users',
      })
    ], []);
    expect(result.licenses.length).toEqual(1);
    expect(result.licenses[0].data.addonLicenseId).toEqual(result.licenses[0].data.appEntitlementNumber);
  });

});
