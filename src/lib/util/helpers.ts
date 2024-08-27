export function isPresent<T>(o: T | undefined | null): o is T {
  return !!o;
}

export function batchesOf<T>(array: T[], count: number): T[][] {
  const tmp = [...array];
  const batches: T[][] = [];
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

interface Closeable {
  close(): void;
}

export function withAutoClose<T extends Closeable | undefined, R>(closeable: T, fn: (o: T) => R): R {
  try {
    return fn(closeable);
  }
  finally {
    closeable?.close();
  }
}
