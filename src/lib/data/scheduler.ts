import * as luxon from 'luxon';
import { keepDataSetConfigFromENV } from "../config/env";

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
    const schedule = parseSchedule(keepDataSetConfigFromENV() ?? '1d');
    return new DataSetScheduler(schedule);
  }

  public constructor(private schedule: Schedule) { }

  /**
   * Returns input objects that match the given schedule.
   * 
   * @param from The moment to start checking backwards from, inclusive.
   * @param timestamped Pre-sorted objects.
   * @returns Input objects that match.
   */
  check<T extends Timestamped>(from: luxon.DateTime, timestamped: T[]) {
    const ok = new Set<T>();
    for (const unit of ['day', 'week', 'month'] as const) {
      const start = from.startOf(unit).until(from.endOf(unit));
      for (let i = 0; i < this.schedule[unit]; i++) {
        const block = start.mapEndpoints(d => d.minus({ [unit]: i }));
        const t = timestamped.find(t => block.contains(t.timestamp));
        if (t) ok.add(t);
      }
    }
    return ok;
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
