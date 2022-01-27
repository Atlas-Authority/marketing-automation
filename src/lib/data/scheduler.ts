
interface Schedule {
  days: number;
  weeks: number;
  months: number;
}

export function parseSchedule(rawSchedule: string): Schedule {
  const keys: Record<string, keyof Schedule> = {
    d: 'days',
    w: 'weeks',
    m: 'months',
  };

  const schedule = {
    days: 0,
    months: 0,
    weeks: 0,
  };

  for (const [, n, k] of rawSchedule.matchAll(/([0-9]+)(d|w|m)/g)) {
    schedule[keys[k]] = +n;
  }

  return schedule;
}
