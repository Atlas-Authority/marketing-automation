import { normalizeMatches } from "./license-grouper";

describe('normalizer', () => {

  it(`matches up all elements at threshold`, () => {
    const results = normalizeMatches([
      { item1: 'b', item2: 'c' },
      { item1: 'a', item2: 'c' },
    ]);
    expect(results).toEqual({
      a: new Set(['a', 'b', 'c']),
      b: new Set(['a', 'b', 'c']),
      c: new Set(['a', 'b', 'c']),
    });
  });

  it(`omits matches under threshold`, () => {
    const results = normalizeMatches([
      { item1: 'b', item2: 'c' },
    ]);
    expect(results).toEqual({
      b: new Set(['b', 'c']),
      c: new Set(['b', 'c']),
    });
  });

  it(`omits every match under threshold`, () => {
    const results = normalizeMatches([
    ]);
    expect(results).toEqual({
    });
  });

});
