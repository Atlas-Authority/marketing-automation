// We have to embed this so we can import it via CJS

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

import { bigram } from './n-gram'

/**
 * Get the edit-distance according to Dice between two values.
 *
 * @param {string|string[]} value
 * @param {string|string[]} alternative
 * @returns {number}
 */
export function diceCoefficient(value, alternative) {
  /** @type {string} */
  let value_
  /** @type {string} */
  let alt
  /** @type {string[]} */
  let left
  /** @type {string[]} */
  let right

  if (Array.isArray(value)) {
    left = value.map((valueBigram) => String(valueBigram).toLowerCase())
  } else {
    value_ = String(value).toLowerCase()
    left = value_.length === 1 ? [value_] : bigram(value_)
  }

  if (Array.isArray(alternative)) {
    right = alternative.map((altBigram) => String(altBigram).toLowerCase())
  } else {
    alt = String(alternative).toLowerCase()
    right = alt.length === 1 ? [alt] : bigram(alt)
  }

  let index = -1
  let intersections = 0
  /** @type {string} */
  let leftPair
  /** @type {string} */
  let rightPair
  /** @type {number} */
  let offset

  while (++index < left.length) {
    leftPair = left[index]
    offset = -1

    while (++offset < right.length) {
      rightPair = right[offset]

      if (leftPair === rightPair) {
        intersections++

        // Make sure this pair never matches again.
        right[offset] = ''
        break
      }
    }
  }

  return (2 * intersections) / (left.length + right.length)
}
