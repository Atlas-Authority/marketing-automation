import { SimilarityScorer } from "./similarity-scorer";

describe('similarity scorer', () => {

  it(`is not very intelligent yet`, () => {
    const scorer = new SimilarityScorer();

    expect(scorer.score(0.0,
      "AB, Inc.",
      "AB inc.",
    )).toBeCloseTo(0.77);

    expect(scorer.score(0.0,
      "Foo.com, LLC",
      "Foo.com",
    )).toBeCloseTo(0.705);

    expect(scorer.score(0.0,
      "Foo-qux.com",
      "Bar-qux.com",
    )).toBeCloseTo(0.70);
  });

});
