import { Entity, EntityDatabase } from './entity.js';

type PersonProps = {
  age: number;
  name: string;
};

class Person extends Entity<PersonProps> {
  pseudoProperties = [];
}

const db: EntityDatabase = {
  getEntity(_kind, _id) {
    throw new Error('should not be called during these tests');
  }
};

describe('entities', () => {

  it('has dynamic data', () => {
    const p = new Person(db, '123', {
      age: 20,
      name: 'Bob',
    }, new Set());
    expect(p.hasPropertyChanges()).toBe(false);
    expect(p.data.age).toEqual(20);
    expect(p.data.name).toEqual('Bob');

    p.data.age++;
    expect(p.hasPropertyChanges()).toBe(true);
    expect(p.data.age).toEqual(21);
    expect(p.data.name).toEqual('Bob');

    p.data.name += 'by';
    expect(p.hasPropertyChanges()).toBe(true);
    expect(p.data.age).toEqual(21);
    expect(p.data.name).toEqual('Bobby');

    p.applyPropertyChanges();
    expect(p.hasPropertyChanges()).toBe(false);
    expect(p.data.age).toEqual(21);
    expect(p.data.name).toEqual('Bobby');
  });

});
