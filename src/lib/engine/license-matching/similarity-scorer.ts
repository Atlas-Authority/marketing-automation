import { diceCoefficient } from "../../external/words/dice-coefficient";

export class SimilarityScorer {

  private NON_EMPTY_FIELD = /[A-Za-z0-9]/;

  /**
   * @param atLeast ignore any values under this percentage
   */
  public score(atLeast: number, a: string | undefined, b: string | undefined) {
    if (!a || !b || !this.NON_EMPTY_FIELD.test(a) || !this.NON_EMPTY_FIELD.test(b)) return 0;
    if (a === b) return 1;
    const score = diceCoefficient(a, b);
    if (score < atLeast) return 0;
    return score;
  }

}
