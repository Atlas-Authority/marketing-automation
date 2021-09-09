import { normalizeMatches } from "./license-grouper.js";

describe('normalizer', () => {

  it(`matches up all elements at threshold`, () => {
    const results = normalizeMatches([
      { item1: 'a', item2: 'b', score: 2 },
      { item1: 'b', item2: 'c', score: 10 },
      { item1: 'a', item2: 'c', score: 12 },
    ], 10);
    expect(results).toEqual({
      a: new Set(['a', 'b', 'c']),
      b: new Set(['a', 'b', 'c']),
      c: new Set(['a', 'b', 'c']),
    });
  });

  it(`omits matches under threshold`, () => {
    const results = normalizeMatches([
      { item1: 'a', item2: 'b', score: 2 },
      { item1: 'b', item2: 'c', score: 10 },
      { item1: 'a', item2: 'c', score: 2 },
    ], 10);
    expect(results).toEqual({
      b: new Set(['b', 'c']),
      c: new Set(['b', 'c']),
    });
  });

  it(`omits every match under threshold`, () => {
    const results = normalizeMatches([
      { item1: 'a', item2: 'b', score: 2 },
      { item1: 'b', item2: 'c', score: 8 },
      { item1: 'a', item2: 'c', score: 2 },
    ], 10);
    expect(results).toEqual({
    });
  });

});
