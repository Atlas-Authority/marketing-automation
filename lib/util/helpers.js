/**
 * @template T
 * @param {T | undefined | null} o
 * @returns {o is T}
 */
export function isPresent(o) { return !!o; }

/**
 * @template T
 * @param {T[]} array
 * @param {number} count
 * @returns {T[][]}
 */
export function batchesOf(array, count) {
  const tmp = [...array];
  const batches = [];
  while (tmp.length) {
    batches.push(tmp.splice(0, count));
  }
  return batches;
}

/**
 * @template T
 * @param {(o:T) => string | number} fn
 * @param {'ASC' | 'DSC'} dir
 */
export function sorter(fn, dir = 'ASC') {
  const down = (dir === 'ASC' ? -1 : 1);
  const up = down * -1;
  return (
    /**
     * @param {T} a
     * @param {T} b
     */
    (a, b) => (
      fn(a) < fn(b) ? down : up
    )
  );
}

/**
 * @param {string | null | undefined} s
 */
export function nonBlankString(s) {
  return s?.trim() || null;
}
