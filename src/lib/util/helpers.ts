export function isPresent<T>(o: T | undefined | null): o is T {
  return !!o;
}

export function batchesOf<T>(array: T[], count: number): T[][] {
  const tmp = [...array];
  const batches = [];
  while (tmp.length) {
    batches.push(tmp.splice(0, count));
  }
  return batches;
}

export function sorter<T>(fn: (o: T) => string | number, dir: 'ASC' | 'DSC' = 'ASC') {
  const down = (dir === 'ASC' ? -1 : 1);
  const up = down * -1;
  return (a: T, b: T) => (
    fn(a) < fn(b) ? down : up
  );
}

export function split<T>(array: T[], inFirstArray: (o: T) => boolean): [T[], T[]] {
  const first: T[] = [];
  const second: T[] = [];
  for (const item of array) {
    const which = (inFirstArray(item) ? first : second);
    which.push(item);
  }
  return [first, second];
}
