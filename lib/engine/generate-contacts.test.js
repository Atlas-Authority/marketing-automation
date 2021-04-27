import { mergeContactProperties } from "./generate-contacts.js";

describe('updating latest contact properties', () => {

  it('chooses latest values', () => {
    let a;

    mergeContactProperties('email2', [
      fakeContact({
        firstname: 'firstname',
        lastname: 'lastname',
        phone: 'phone',
        city: 'city',
        state: 'state',
      }),
      a = fakeContact({
        updated: '2021-04-02',
        country: 'country2',
        region: 'region2',
        hosting: 'hosting2',
        email: 'email2',
      }),
    ]);

    expect(a).toEqual(fakeContact({
      updated: '2021-04-02',
      country: 'country2',
      region: 'region2',
      hosting: 'hosting2',
      email: 'email2',
      firstname: 'firstname',
      lastname: 'lastname',
      phone: 'phone',
      city: 'city',
      state: 'state',
    }));
  });

  it('gathers name, phone, and address separately', () => {
    let a;

    mergeContactProperties('email2', [
      fakeContact({
        firstname: 'firstname',
        lastname: 'lastname',
      }),
      fakeContact({
        phone: 'phone',
      }),
      fakeContact({
        city: 'city',
        state: 'state',
      }),
      a = fakeContact({
        updated: '2021-04-02',
        country: 'country2',
        region: 'region2',
        hosting: 'hosting2',
        email: 'email2',
      }),
    ]);

    expect(a).toEqual(fakeContact({
      updated: '2021-04-02',
      country: 'country2',
      region: 'region2',
      hosting: 'hosting2',
      email: 'email2',
      firstname: 'firstname',
      lastname: 'lastname',
      phone: 'phone',
      city: 'city',
      state: 'state',
    }));
  });

  it('picks the canonical by latest updated, regardless of order', () => {
    let a;

    mergeContactProperties('email2', [
      fakeContact({
        firstname: 'firstname',
        lastname: 'lastname',
      }),
      a = fakeContact({
        updated: '2021-04-02',
        country: 'country2',
        region: 'region2',
        hosting: 'hosting2',
        email: 'email2',
      }),
      fakeContact({
        phone: 'phone',
      }),
      fakeContact({
        city: 'city',
        state: 'state',
      }),
    ]);

    expect(a).toEqual(fakeContact({
      updated: '2021-04-02',
      country: 'country2',
      region: 'region2',
      hosting: 'hosting2',
      email: 'email2',
      firstname: 'firstname',
      lastname: 'lastname',
      phone: 'phone',
      city: 'city',
      state: 'state',
    }));
  });

  it('gets the newest full firstname/lastname pair if present', () => {
    let a;

    mergeContactProperties('email1', [
      fakeContact({
        updated: '2021-03-05',
        firstname: 'firstname1',
      }),
      fakeContact({
        updated: '2021-03-05',
        lastname: 'lastname1',
      }),
      fakeContact({
        updated: '2021-03-01',
        firstname: 'firstname2',
        lastname: 'lastname2',
      }),
      a = fakeContact({}),
    ]);

    expect(a).toEqual(fakeContact({
      firstname: 'firstname2',
      lastname: 'lastname2',
    }));
  });

  it('uses first found firstname and lastname if no pair present', () => {
    let a;

    mergeContactProperties('email1', [
      fakeContact({
        firstname: 'firstname1',
      }),
      fakeContact({
        lastname: 'lastname2',
      }),
      a = fakeContact({}),
    ]);

    expect(a).toEqual(fakeContact({
      firstname: 'firstname1',
      lastname: 'lastname2',
    }));
  });

  it('uses neither city nor state if no pair present', () => {
    let a;

    mergeContactProperties('email1', [
      fakeContact({
        city: 'city1',
      }),
      fakeContact({
        state: 'state2',
      }),
      a = fakeContact({}),
    ]);

    expect(a).toEqual(fakeContact({
      city: 'city1',
      state: 'state2',
    }));
  });

  it('updates canonical to Partner if any are Partner', () => {
    let a;

    mergeContactProperties('email1', [
      fakeContact({
        city: 'city1',
        contact_type: 'Partner',
      }),
      fakeContact({
        state: 'state2',
      }),
      a = fakeContact({}),
    ]);

    expect(a).toEqual(fakeContact({
      city: 'city1',
      state: 'state2',
      contact_type: 'Partner',
    }));
  });

  it('makes the last as canonical when "updated" is tied', () => {
    let a;

    mergeContactProperties('email1', [
      fakeContact({
        email: 'email2',
        firstname: 'firstname1',
        lastname: 'lastname1',
        phone: 'phone',
        city: 'city',
        state: 'state',
        company_id: null,
      }),
      a = fakeContact({
        email: 'email1',
        firstname: 'firstname2',
        lastname: 'lastname2',
        phone: null,
        city: null,
        state: null,
        company_id: null,
      }),
    ]);

    expect(a).toEqual(fakeContact({
      email: 'email1',
      firstname: 'firstname2',
      lastname: 'lastname2',
      phone: 'phone',
      city: 'city',
      state: 'state',
      company_id: null,
    }));
  });

});

/**
 * @param {{ [key: string]: string | null }} props
 * @returns {import("./generate-contacts.js").TmpContact}
 */
function fakeContact(props) {
  return {
    updated: props.updated || '2021-04-01',
    contact_type: /** @type {any} */(props.contact_type) || 'Customer',
    country: props.country || 'country1',
    region: props.region || 'region1',
    hosting: props.hosting || 'hosting1',
    email: props.email || 'email1',
    firstname: props.firstname || null,
    lastname: props.lastname || null,
    phone: props.phone || null,
    city: props.city || null,
    state: props.state || null,
    company_id: null,
  };
}
