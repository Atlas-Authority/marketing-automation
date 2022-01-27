import * as luxon from 'luxon';
import { DataSetScheduler, parseSchedule } from "../lib/data/scheduler";

describe(`Scheduler`, () => {

  it(`Can parse syntax`, () => {
    expect(parseSchedule(`8d 5w 2m`)).toEqual({
      days: 8,
      weeks: 5,
      months: 2,
    });

    expect(parseSchedule(`10w`)).toEqual({
      days: 0,
      weeks: 10,
      months: 0,
    });

    expect(parseSchedule(``)).toEqual({
      days: 0,
      weeks: 0,
      months: 0,
    });
  });

  it(`Can tell if timestamps are within schedule`, () => {
    const scheduler = new DataSetScheduler({
      days: 3,
      weeks: 0,
      months: 0,
    });

    const t1 = { timestamp: luxon.DateTime.fromISO('2020-01-01T08') };
    const t2 = { timestamp: luxon.DateTime.fromISO('2020-01-02T08') };
    const t3 = { timestamp: luxon.DateTime.fromISO('2020-01-03T08') };
    const t4 = { timestamp: luxon.DateTime.fromISO('2020-01-04T08') };
    const t5 = { timestamp: luxon.DateTime.fromISO('2020-01-05T08') };

    expect(scheduler.check(
      luxon.DateTime.fromISO('2020-01-04T11'),
      [t1, t2, t3, t4, t5]
    )).toEqual(
      new Set([t2, t3, t4])
    );
  });

});
