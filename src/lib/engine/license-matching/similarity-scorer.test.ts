import 'source-map-support';
import { SimilarityScorer } from "./similarity-scorer";

describe('similarity scorer', () => {

  it(`is not very intelligent yet`, () => {
    const scorer = new SimilarityScorer();

    expect(scorer.score(0.0,
      "AB, Inc.".toLowerCase(),
      "AB inc.".toLowerCase(),
    )).toBeCloseTo(0.77);

    expect(scorer.score(0.0,
      "Foo.com, LLC".toLowerCase(),
      "Foo.com".toLowerCase(),
    )).toBeCloseTo(0.705);

    expect(scorer.score(0.0,
      "Foo-qux.com".toLowerCase(),
      "Bar-qux.com".toLowerCase(),
    )).toBeCloseTo(0.70);
  });

});
