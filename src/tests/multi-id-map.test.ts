import { MultiRecordMap } from "../lib/data-shift/multi-id-map";

const o1a = { ids: ['a', 'b'] };
const o1b = { ids: ['b', 'c'] };
const o1c = { ids: ['c'] };
const o2 = { ids: ['d'] };

describe(`Multi-ID Map`, () => {

  it(`Starts out empty`, () => {
    const map = new MultiRecordMap();
    expect([...map.entries()]).toEqual([
    ]);
  });

  it(`Can set a single entry as normal`, () => {
    const map = new MultiRecordMap();
    map.set(o1a, 22);
    expect([...map.entries()]).toEqual([
      [o1a, 22],
    ]);
  });

  it(`Returns the first entry when two identical are set`, () => {
    const map = new MultiRecordMap();
    map.set(o1a, 22);
    map.set(o1b, 33);
    expect([...map.entries()]).toEqual([
      [o1a, 33],
    ]);
  });

  it(`Returns the first entry with three identical are set`, () => {
    const map = new MultiRecordMap();
    map.set(o1a, 22);
    map.set(o1b, 33);
    map.set(o1c, 44);
    expect([...map.entries()]).toEqual([
      [o1a, 44],
    ]);
  });

  it(`Returns separate entries separately`, () => {
    const map = new MultiRecordMap();
    map.set(o1a, 22);
    map.set(o1b, 33);
    map.set(o1c, 44);
    map.set(o2, 55);
    expect([...map.entries()]).toEqual([
      [o1a, 44],
      [o2, 55],
    ]);
  });

});
