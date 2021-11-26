// We have to embed this so we can import dice-coefficient (which uses this) via CJS

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

export var bigram = nGram(2)
export var trigram = nGram(3)

/**
 * Factory returning a function that converts a value string to n-grams.
 *
 * @param {number} n
 */
export function nGram(n) {
  if (
    typeof n !== 'number' ||
    Number.isNaN(n) ||
    n < 1 ||
    n === Number.POSITIVE_INFINITY
  ) {
    throw new Error('`' + n + '` is not a valid argument for `n-gram`')
  }

  return grams

  /**
   * Create n-grams from a given value.
   *
   * @template {string|string[]} T
   * @param {T} [value]
   * @returns {T[]}
   */
  function grams(value) {
    /** @type {T[]} */
    var nGrams = []
    /** @type {number} */
    var index
    /** @type {string|string[]} */
    var source

    if (value === null || value === undefined) {
      return nGrams
    }

    // @ts-ignore
    source = value.slice ? value : String(value)
    index = source.length - n + 1

    if (index < 1) {
      return nGrams
    }

    while (index--) {
      // @ts-ignore
      nGrams[index] = source.slice(index, index + n)
    }

    return nGrams
  }
}
