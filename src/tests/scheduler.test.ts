import * as luxon from 'luxon';
import { DataSetScheduler, parseSchedule } from "../lib/data/scheduler";

describe(`Scheduler`, () => {

  it(`Can parse syntax`, () => {
    expect(parseSchedule(`8d 5w 2m`)).toEqual({
      day: 8,
      week: 5,
      month: 2,
    });

    expect(parseSchedule(`10w`)).toEqual({
      day: 0,
      week: 10,
      month: 0,
    });

    expect(parseSchedule(``)).toEqual({
      day: 0,
      week: 0,
      month: 0,
    });
  });

  it(`Can tell if timestamps are within schedule`, () => {
    const scheduler = new DataSetScheduler({
      day: 3,
      week: 0,
      month: 0,
    });

    const from = luxon.DateTime.fromISO('2020-01-04T11');

    const t1 = { timestamp: from.minus({ days: 3 }) };
    const t2 = { timestamp: from.minus({ days: 2 }) };
    const t3 = { timestamp: from.minus({ days: 1 }) };
    const t4 = { timestamp: from };
    const t5 = { timestamp: from.plus({ days: 1 }) };

    expect(scheduler.check(from, [t1, t2, t3, t4, t5])).toEqual(
      new Set([t2, t3, t4])
    );
  });

  it(`Can work with weeks`, () => {
    const scheduler = new DataSetScheduler({
      day: 0,
      week: 3,
      month: 0,
    });

    const from = luxon.DateTime.fromISO('2020-01-04T11');

    const t1 = { timestamp: from.minus({ weeks: 3 }) };
    const t2 = { timestamp: from.minus({ weeks: 2 }) };
    const t3 = { timestamp: from.minus({ weeks: 1 }) };
    const t4 = { timestamp: from };
    const t5 = { timestamp: from.plus({ weeks: 1 }) };

    expect(scheduler.check(from, [t1, t2, t3, t4, t5])).toEqual(
      new Set([t2, t3, t4])
    );
  });

  it(`Can work with months`, () => {
    const scheduler = new DataSetScheduler({
      day: 0,
      week: 0,
      month: 3,
    });

    const from = luxon.DateTime.fromISO('2020-01-04T11');

    const t1 = { timestamp: from.minus({ months: 3 }) };
    const t2 = { timestamp: from.minus({ months: 2 }) };
    const t3 = { timestamp: from.minus({ months: 1 }) };
    const t4 = { timestamp: from };
    const t5 = { timestamp: from.plus({ months: 1 }) };

    expect(scheduler.check(from, [t1, t2, t3, t4, t5])).toEqual(
      new Set([t2, t3, t4])
    );
  });

});
