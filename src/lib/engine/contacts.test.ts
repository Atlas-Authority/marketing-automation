import { contactToHubspotProperties } from "./contacts.js";

describe('contact upserting', () => {

  it(`omits anything not passed`, () => {
    expect(contactToHubspotProperties({
    })).toEqual({
    });
  });

  it(`stringifies most properties`, () => {
    expect(contactToHubspotProperties({
      contact_type: 'Customer',
      email: 'email1',
      hosting: 'hosting1',
      country: 'country1',
      region: 'region1',
      deployment: 'Cloud',
      last_mpac_event: '2021-04-01',
      firstname: null,
      lastname: null,
      city: null,
      state: null,
      phone: null,
    })).toEqual({
      contact_type: 'Customer',
      email: 'email1',
      hosting: 'hosting1',
      country: 'country1',
      region: 'region1',
      deployment: 'Cloud',
      last_mpac_event: '2021-04-01',
      firstname: '',
      lastname: '',
      city: '',
      state: '',
      phone: '',
    });
  });

  it(`properly transforms the other properties`, () => {
    expect(contactToHubspotProperties({
      related_products: ['Jira', 'Confluence'],
      license_tier: 1234,
    })).toEqual({
      related_products: 'Jira;Confluence',
      license_tier: '1234',
    });
  });

  it(`can transform all properties`, () => {
    expect(contactToHubspotProperties({
      contact_type: 'Customer',
      email: 'email1',
      hosting: 'hosting1',
      country: 'country1',
      region: 'region1',
      deployment: 'Cloud',
      last_mpac_event: '2021-04-01',
      firstname: 'firstname',
      lastname: 'lastname',
      city: 'city',
      state: 'state',
      phone: 'phone',
      related_products: ['Jira', 'Confluence'],
      license_tier: 1234,
    })).toEqual({
      contact_type: 'Customer',
      email: 'email1',
      hosting: 'hosting1',
      country: 'country1',
      region: 'region1',
      deployment: 'Cloud',
      last_mpac_event: '2021-04-01',
      firstname: 'firstname',
      lastname: 'lastname',
      city: 'city',
      state: 'state',
      phone: 'phone',
      related_products: 'Jira;Confluence',
      license_tier: '1234',
    });
  });

});
