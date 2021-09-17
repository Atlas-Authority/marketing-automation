import { diceCoefficient as dice } from 'dice-coefficient';

export class SimilarityScorer {

  NON_EMPTY_FIELD = /[A-Za-z0-9]/;

  /**
   * @param atLeast ignore any values under this percentage
   */
  score(atLeast: number, a: string | undefined, b: string | undefined) {
    if (!a || !b || !this.NON_EMPTY_FIELD.test(a) || !this.NON_EMPTY_FIELD.test(b)) return 0;
    const score = dice(a, b);
    if (score < atLeast) return 0;
    return score;
  }

}
