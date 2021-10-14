import { HubspotEntity, HubspotProps } from "./entity.js";

type PersonProps = {
  name: string;
  age: number;
};

class Person extends HubspotEntity<PersonProps> {

  override toAPI(): HubspotProps<PersonProps> {
    return {
      age: this.props.age.toString(),
      name: this.props.name,
    };
  }

  override fromAPI(data: HubspotProps<PersonProps>): PersonProps {
    return {
      age: +data.age,
      name: data.name,
    };
  }

}

describe(`entities`, () => {

  it(`can update and check for new properties`, () => {
    const p = new Person({
      props: {
        age: 3,
        name: 'fred',
      },
    });
    p.set('age', 3);
    expect(p.hasChanges()).toBe(false);
    expect(p.newProps).toStrictEqual({});
    p.set('age', 4);
    expect(p.hasChanges()).toBe(true);
    expect(p.newProps).toStrictEqual({ age: 4 });
    p.set('age', 3);
    expect(p.hasChanges()).toBe(false);
    expect(p.newProps).toStrictEqual({});
    p.set('name', 'bob');
    expect(p.hasChanges()).toBe(true);
    expect(p.newProps).toStrictEqual({ name: 'bob' });
    p.set('age', 4);
    expect(p.hasChanges()).toBe(true);
    expect(p.newProps).toStrictEqual({ age: 4, name: 'bob' });
    p.set('name', 'fred');
    expect(p.hasChanges()).toBe(true);
    expect(p.newProps).toStrictEqual({ age: 4 });
    p.set('age', 3);
    expect(p.hasChanges()).toBe(false);
    expect(p.newProps).toStrictEqual({});
  });

  it(`can apply new properties`, () => {
    const p = new Person({
      props: {
        age: 3,
        name: 'fred',
      },
    });
    expect(p.hasChanges()).toBe(false);
    expect(p.props).toStrictEqual({
      age: 3,
      name: 'fred',
    });
    p.set('age', 4);
    p.applyUpdates();
    expect(p.props).toStrictEqual({
      age: 4,
      name: 'fred',
    });
    p.set('name', 'bob');
    p.set('age', 5);
    p.applyUpdates();
    expect(p.props).toStrictEqual({
      age: 5,
      name: 'bob',
    });
  });

});
