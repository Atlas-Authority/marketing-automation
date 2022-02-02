import * as luxon from 'luxon';
import { keepDataSetConfigFromENV } from "../config/env";
import { sorter } from '../util/helpers';

interface Schedule {
  day: number;
  week: number;
  month: number;
}

interface Timestamped {
  timestamp: luxon.DateTime,
}

export class DataSetScheduler {

  public static fromENV() {
    const schedule = parseSchedule(keepDataSetConfigFromENV() || '1d');
    return new DataSetScheduler(schedule);
  }

  public constructor(private schedule: Schedule) { }

  public readableSchedule() {
    return (Object.entries(this.schedule)
      .filter(([unit, n]) => n > 0)
      .map(([unit, n]) => `First each ${unit} for past ${n} ${unit}s`)
    );
  }

  /**
   * @param from Moment within the block to start checking backwards from, inclusive.
   * @returns Input objects that match the schedule.
   */
  public check<T extends Timestamped>(from: luxon.DateTime, timestamped: T[]) {
    const sortByTimestamp = sorter((o: T) => o.timestamp.toMillis());
    const toCheck = [...timestamped].sort(sortByTimestamp);

    const ok = new Set<T>();
    for (const unit of ['day', 'week', 'month'] as const) {
      const start = from.startOf(unit).until(from.endOf(unit));
      for (let i = 0; i < this.schedule[unit]; i++) {
        const block = start.mapEndpoints(d => d.minus({ [unit]: i }));
        const t = toCheck.find(t => block.contains(t.timestamp));
        if (t) ok.add(t);
      }
    }

    return [...ok].sort(sortByTimestamp);
  }

}

export function parseSchedule(rawSchedule: string): Schedule {
  const keys: Record<string, keyof Schedule> = {
    d: 'day',
    w: 'week',
    m: 'month',
  };

  const schedule = {
    day: 0,
    month: 0,
    week: 0,
  };

  for (const [, n, k] of rawSchedule.matchAll(/([0-9]+)(d|w|m)/gi)) {
    schedule[keys[k]] = +n;
  }

  return schedule;
}
