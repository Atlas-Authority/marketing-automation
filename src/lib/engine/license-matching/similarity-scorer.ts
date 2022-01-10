/**
 * @param atLeast ignore any values under this percentage
 */
export function scoreSimilarity(atLeast: number, a: string, b: string) {
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const score = diceCoefficient(a, b);
  if (score < atLeast) return 0;
  return score;
}

// Modified versions of Mr. Wormer's libraries dice-coefficient and n-grams

/**
 * (The MIT License)
 * 
 * Copyright (c) 2014 Titus Wormer <tituswormer@gmail.com>
 * 
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files (the
 * 'Software'), to deal in the Software without restriction, including
 * without limitation the rights to use, copy, modify, merge, publish,
 * distribute, sublicense, and/or sell copies of the Software, and to
 * permit persons to whom the Software is furnished to do so, subject to
 * the following conditions:
 * 
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
 * IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
 * CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
 * TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
 * SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

function diceCoefficient(value: string, alternative: string): number {
  const left = bigram(value);
  const right = bigram(alternative);

  let index = -1;
  let intersections = 0;

  let leftPair: string;
  let rightPair: string;
  let offset: number;

  while (++index < left.length) {
    leftPair = left[index];
    offset = -1;

    while (++offset < right.length) {
      rightPair = right[offset];

      if (leftPair === rightPair) {
        intersections++;

        // Make sure this pair never matches again.
        right[offset] = '';
        break;
      }
    }
  }

  return (2 * intersections) / (left.length + right.length);
}

function bigram(value: string) {
  const pairs = [];
  const n = 2;
  let i = value.length - n + 1;
  while (i--) pairs[i] = value.slice(i, i + n);
  return pairs;
}
