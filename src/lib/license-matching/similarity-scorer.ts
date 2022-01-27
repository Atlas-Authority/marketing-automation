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

function diceCoefficient(a: string, b: string): number {
  let index = -1;
  let intersections = 0;
  let offset: number;
  const seen: boolean[] = [];

  const al = a.length - 1;
  const bl = b.length - 1;

  while (++index < al) {
    offset = -1;
    while (++offset < bl) {
      if (a[index] === b[offset] && a[index + 1] === b[offset + 1] && !seen[offset]) {
        intersections++;

        // Make sure this pair never matches again.
        seen[offset] = true;
        break;
      }
    }
  }

  return (2 * intersections) / (al + bl);
}
