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

  it(`Can work with combinations of units of time`, () => {
    const scheduler = new DataSetScheduler({
      day: 3,
      week: 3,
      month: 3,
    });

    const from = luxon.DateTime.fromISO('2020-05-20T11');

    const d1 = { timestamp: luxon.DateTime.fromISO('2020-05-17T09') };
    const d2 = { timestamp: luxon.DateTime.fromISO('2020-05-18T09') }; // good
    const d3 = { timestamp: luxon.DateTime.fromISO('2020-05-19T09') }; // good
    const d4 = { timestamp: luxon.DateTime.fromISO('2020-05-20T09') }; // good
    const d5 = { timestamp: luxon.DateTime.fromISO('2020-05-21T09') };

    const w1 = { timestamp: luxon.DateTime.fromISO('2020-04-29T10') };
    const w2 = { timestamp: luxon.DateTime.fromISO('2020-05-06T10') }; // good
    const w3 = { timestamp: luxon.DateTime.fromISO('2020-05-13T10') }; // good
    const w4 = { timestamp: luxon.DateTime.fromISO('2020-05-20T10') }; // good
    const w5 = { timestamp: luxon.DateTime.fromISO('2020-05-27T10') };

    const m1 = { timestamp: luxon.DateTime.fromISO('2020-02-20T11') };
    const m2 = { timestamp: luxon.DateTime.fromISO('2020-03-20T11') }; // good
    const m3 = { timestamp: luxon.DateTime.fromISO('2020-04-20T11') }; // good
    const m4 = { timestamp: luxon.DateTime.fromISO('2020-05-20T11') }; // good
    const m5 = { timestamp: luxon.DateTime.fromISO('2020-06-20T11') };

    const input = [
      d1, d2, d3, d4, d5,
      w1, w2, w3, w4, w5,
      m1, m2, m3, m4, m5,
    ].sort(sortTimestamped);

    const output = [...scheduler.check(from, input)];

    expect(output.sort(sortTimestamped)).toEqual(
      [
        d2, d3, d4,
        w2, w3,
        m2, m3,
      ].sort(sortTimestamped)
    );

    /**
     * Scheduler rules that are valid but not obvious:
     * 
     * Q. Why weren't w4 and m4 in there?
     * A. They're same as d4, and first match (d4) wins.
     */

  });

});

function sortTimestamped<T extends { timestamp: luxon.DateTime }>(a: T, b: T) {
  const t1 = a.timestamp.toMillis();
  const t2 = b.timestamp.toMillis();
  return t1 < t2 ? -1 : t1 > t2 ? 1 : 0;
}
