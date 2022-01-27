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

  check<T extends Timestamped>(from: luxon.DateTime, timestamped: T[]) {
    const ok = new Set<T>();

    const startDay = from.startOf('day').until(from.endOf('day'));

    for (let i = 0; i < this.schedule.day; i++) {
      const day = startDay.mapEndpoints(d => d.minus({ day: i }));
      const t = timestamped.find(t => day.contains(t.timestamp));
      if (t) ok.add(t);
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
